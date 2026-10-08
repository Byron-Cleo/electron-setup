import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth"
import { getAccompaniments, getMenuByMealType, getOrders } from "@/lib/api"

const STORAGE_KEY = "eraeva.waiterOrder.v2"

/**
 * How many servings of this dish the pool can still cover. The pool holds
 * *plates*, and a serving costs a dish- or portion-specific number of them, so
 * a dish with a 0.5 factor can be sold twice from one remaining plate. Never
 * round up: a partial serving is not orderable.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function sellableServingsFor(item: MenuItem, portion: MenuPortionOption | null = null): number {
  const plates = Number(item.availablePlates ?? item.stock ?? 0)
  // A portion carries its own consumption rate, so it must win over the
  // item-wide figure the server precomputed from the supply link. Otherwise a
  // 2pc portion would show the same count as the 1pc default.
  const portionRate = Number(portion?.platesPerServing)
  if (Number.isFinite(portionRate) && portionRate > 0) {
    if (!Number.isFinite(plates) || plates <= 0) return 0
    return Math.floor(plates / portionRate)
  }
  if (item.sellableServings !== undefined) return item.sellableServings
  const factor = Number(item.platesPerServing ?? 1)
  if (!Number.isFinite(plates) || plates <= 0) return 0
  if (!Number.isFinite(factor) || factor <= 0) return 0
  return Math.floor(plates / factor)
}

/** The portion preselected for a dish (explicit default, else first option). */
// eslint-disable-next-line react-refresh/only-export-components
export function defaultPortionFor(item: MenuItem): MenuPortionOption | null {
  const options = item.portionOptions ?? []
  if (options.length === 0) return null
  return options.find((o) => o.id === item.defaultPortionId) ?? options[0]
}

function orderLineKey(
  menuItemId: string,
  starchId?: string | null,
  vegetableId?: string | null,
  portionId?: string | null,
): string {
  return `${menuItemId}|${starchId ?? ""}|${vegetableId ?? ""}|${portionId ?? ""}`
}

function lineKey(item: OrderLineItem): string {
  return orderLineKey(item.menuItem.id, item.starch?.id, item.vegetable?.id, item.portion?.id)
}

function toCartAccompaniment(a: Accompaniment | undefined): OrderAccompaniment | null {
  if (!a) return null
  return { id: a.id, name: a.name, category: a.category, price: a.price, isDefault: a.isDefault }
}

interface WaiterOrderContextValue {
  items: OrderLineItem[]
  addToOrder: (
    item: MenuItem,
    starch: OrderAccompaniment | null,
    vegetable: OrderAccompaniment | null,
    portion?: MenuPortionOption | null,
    qty?: number,
  ) => void
  updateAccompaniments: (key: string, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => void
  updateQuantity: (key: string, delta: number) => void
  removeItem: (key: string) => void
  clearOrder: () => void
  totalPrice: number
  voidedOrders: Order[]
  clearVoidedOrder: (id: string) => void
  replacementTargetId: string | null
  setReplacementTargetId: (id: string | null) => void
  prefillFromVoid: (order: Order) => Promise<void>
  /**
   * Clamp lines the server said we could not cover, keeping the rest of the
   * cart intact. Returns the lines that were actually changed.
   */
  applyShortfalls: (shortfalls: StockShortfall[]) => string[]
}

const WaiterOrderContext = createContext<WaiterOrderContextValue | null>(null)

function linePrice(item: OrderLineItem): number {
  // A portion is the thing being sold, so its price replaces the dish price —
  // charging both would bill 1pc Fried Eggs as dish + portion.
  const base = item.portion
    ? Number(item.portion.price)
    : Number(item.menuItem.price)
  return (base + Number(item.starch?.price ?? 0) + Number(item.vegetable?.price ?? 0)) * item.quantity
}

export function WaiterOrderProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)

  const [items, setItems] = useState<OrderLineItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as { waiterId: string; items: OrderLineItem[] }
      if (parsed.waiterId !== user?.id) return []
      return parsed.items
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ waiterId: user?.id ?? null, items }))
    } catch {
      // storage unavailable — ignore
    }
  }, [items, user?.id])

  const [voidedOrders, setVoidedOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchVoidedOrders() {
      try {
        const orders = await getOrders()
        const today = new Date().toDateString()
        // Voided orders that already have a replacement are done — don't nag again
        const replacedIds = new Set(
          orders.filter((o) => !o.isVoid && o.voidedOrderId).map((o) => o.voidedOrderId as string),
        )
        const voided = orders
          .filter(
            (o) =>
              o.isVoid &&
              o.userId === user?.id &&
              new Date(o.createdAt).toDateString() === today &&
              !replacedIds.has(o.id),
          )
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        if (!cancelled) setVoidedOrders(voided)
      } catch {
        // Ignore errors for voided orders
      }
    }
    fetchVoidedOrders()
    return () => {
      cancelled = true
    }
  }, [user])

  const clearVoidedOrder = useCallback((id: string) => {
    setVoidedOrders((prev) => prev.filter((o) => o.id !== id))
  }, [])

  const [replacementTargetId, setReplacementTargetId] = useState<string | null>(null)

  // Best-effort: merge the voided order's lines into the current cart, clamped
  // to today's stock; unavailable items are skipped silently
  const prefillFromVoid = useCallback(async (order: Order) => {
    try {
      const [menuItems, accompaniments] = await Promise.all([
        getMenuByMealType(order.mealType),
        getAccompaniments(),
      ])
      const menuById = new Map(menuItems.map((m) => [m.id, m]))
      const accById = new Map(accompaniments.map((a) => [a.id, a]))
      setItems((prev) => {
        const next = [...prev]
        for (const oi of order.OrderItem ?? []) {
          const menuItem = menuById.get(oi.menuId)
          if (!menuItem) continue
          const portion =
            (menuItem.portionOptions ?? []).find((p) => p.id === oi.portionId) ?? null
          const cap = sellableServingsFor(menuItem, portion)
          if (cap <= 0) continue
          const quantity = Math.min(oi.qty, cap)
          if (quantity <= 0) continue
          const starch = oi.starchId ? toCartAccompaniment(accById.get(oi.starchId)) : null
          const vegetable = oi.vegetableId ? toCartAccompaniment(accById.get(oi.vegetableId)) : null
          const key = orderLineKey(menuItem.id, starch?.id, vegetable?.id, portion?.id)
          const idx = next.findIndex((line) => lineKey(line) === key)
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              quantity: Math.min(next[idx].quantity + quantity, cap),
            }
          } else {
            next.push({ menuItem, quantity, starch, vegetable, portion })
          }
        }
        return next
      })
    } catch {
      // Prefill failure is non-fatal — waiter builds the order manually
    }
  }, [])

  const addToOrder = useCallback(
    (
      item: MenuItem,
      starch: OrderAccompaniment | null,
      vegetable: OrderAccompaniment | null,
      portion: MenuPortionOption | null = null,
      qty = 1,
    ) => {
      const key = orderLineKey(item.id, starch?.id, vegetable?.id, portion?.id)
      const cap = sellableServingsFor(item, portion)
      setItems((prev) => {
        const existing = prev.find((oi) => lineKey(oi) === key)
        const add = Math.max(1, qty)
        if (existing) {
          return prev.map((oi) =>
            lineKey(oi) === key
              ? { ...oi, quantity: Math.min(oi.quantity + add, cap) }
              : oi,
          )
        }
        return [...prev, { menuItem: item, quantity: Math.min(add, cap), starch, vegetable, portion }]
      })
    },
    [],
  )

  const updateQuantity = useCallback((key: string, delta: number) => {
    setItems((prev) =>
      prev.flatMap((oi) => {
        if (lineKey(oi) !== key) return [oi]
        const next = oi.quantity + delta
        if (next <= 0) return []
        return [{ ...oi, quantity: Math.min(next, sellableServingsFor(oi.menuItem, oi.portion)) }]
      }),
    )
  }, [])

  // Used when the server rejects an order for lack of stock. Lines above the
  // real ceiling are trimmed (or dropped when the pool is empty) and every other
  // line is left exactly as the waiter built it — the cart survives a rejection.
  const applyShortfalls = useCallback((shortfalls: StockShortfall[]) => {
    const capByMenu = new Map<string, number>()
    for (const s of shortfalls) capByMenu.set(s.menuId, Math.max(0, Math.floor(s.available)))

    const changed: string[] = []
    setItems((prev) =>
      prev.flatMap((oi) => {
        const cap = capByMenu.get(oi.menuItem.id)
        if (cap === undefined) return [oi]
        if (oi.quantity <= cap) return [oi]
        changed.push(oi.menuItem.name)
        return cap > 0 ? [{ ...oi, quantity: cap }] : []
      }),
    )
    return changed
  }, [])

  const updateAccompaniments = useCallback(
    (key: string, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => {
      setItems((prev) =>
        prev.map((oi) => (lineKey(oi) === key ? { ...oi, starch, vegetable } : oi)),
      )
    },
    [],
  )

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((oi) => lineKey(oi) !== key))
  }, [])

  const clearOrder = useCallback(() => {
    setItems([])
  }, [])

  const totalPrice = useMemo(() => {
    return items.reduce((sum, oi) => sum + linePrice(oi), 0)
  }, [items])

  const value = useMemo(
    () => ({ items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice, voidedOrders, clearVoidedOrder, replacementTargetId, setReplacementTargetId, prefillFromVoid, applyShortfalls }),
    [items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice, voidedOrders, clearVoidedOrder, replacementTargetId, prefillFromVoid, applyShortfalls],
  )

  return <WaiterOrderContext.Provider value={value}>{children}</WaiterOrderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWaiterOrder() {
  const ctx = useContext(WaiterOrderContext)
  if (!ctx) throw new Error("useWaiterOrder must be used within a WaiterOrderProvider")
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export { orderLineKey, lineKey }
