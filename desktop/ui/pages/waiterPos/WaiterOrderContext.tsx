import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth"
import { getAccompaniments, getMenuByMealType, getOrders } from "@/lib/api"

const STORAGE_KEY = "eraeva.waiterOrder.v1"

function platesFor(item: MenuItem): number {
  return item.availablePlates ?? item.stock
}

function orderLineKey(menuItemId: string, starchId?: string | null, vegetableId?: string | null): string {
  return `${menuItemId}|${starchId ?? ""}|${vegetableId ?? ""}`
}

function lineKey(item: OrderLineItem): string {
  return orderLineKey(item.menuItem.id, item.starch?.id, item.vegetable?.id)
}

function toCartAccompaniment(a: Accompaniment | undefined): OrderAccompaniment | null {
  if (!a) return null
  return { id: a.id, name: a.name, category: a.category, price: a.price, isDefault: a.isDefault }
}

interface WaiterOrderContextValue {
  items: OrderLineItem[]
  addToOrder: (item: MenuItem, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => void
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
}

const WaiterOrderContext = createContext<WaiterOrderContextValue | null>(null)

function linePrice(item: OrderLineItem): number {
  return (Number(item.menuItem.price) + Number(item.starch?.price ?? 0) + Number(item.vegetable?.price ?? 0)) * item.quantity
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
          if (!menuItem || platesFor(menuItem) <= 0) continue
          const quantity = Math.min(oi.qty, platesFor(menuItem))
          if (quantity <= 0) continue
          const starch = oi.starchId ? toCartAccompaniment(accById.get(oi.starchId)) : null
          const vegetable = oi.vegetableId ? toCartAccompaniment(accById.get(oi.vegetableId)) : null
          const key = orderLineKey(menuItem.id, starch?.id, vegetable?.id)
          const idx = next.findIndex((line) => lineKey(line) === key)
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              quantity: Math.min(next[idx].quantity + quantity, platesFor(menuItem)),
            }
          } else {
            next.push({ menuItem, quantity, starch, vegetable })
          }
        }
        return next
      })
    } catch {
      // Prefill failure is non-fatal — waiter builds the order manually
    }
  }, [])

  const addToOrder = useCallback(
    (item: MenuItem, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => {
      const key = orderLineKey(item.id, starch?.id, vegetable?.id)
      setItems((prev) => {
        const existing = prev.find((oi) => lineKey(oi) === key)
        if (existing) {
          return prev.map((oi) =>
            lineKey(oi) === key
              ? { ...oi, quantity: Math.min(oi.quantity + 1, platesFor(item)) }
              : oi,
          )
        }
        return [...prev, { menuItem: item, quantity: 1, starch, vegetable }]
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
        return [{ ...oi, quantity: Math.min(next, platesFor(oi.menuItem)) }]
      }),
    )
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
    () => ({ items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice, voidedOrders, clearVoidedOrder, replacementTargetId, setReplacementTargetId, prefillFromVoid }),
    [items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice, voidedOrders, clearVoidedOrder, replacementTargetId, prefillFromVoid],
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
