import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth"

const STORAGE_KEY = "eraeva.waiterOrder.v1"

function platesFor(item: MenuItem): number {
  return item.availablePlates ?? item.stock
}

interface WaiterOrderContextValue {
  items: OrderLineItem[]
  addToOrder: (item: MenuItem, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => void
  updateAccompaniments: (menuId: string, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => void
  updateQuantity: (menuId: string, delta: number) => void
  removeItem: (menuId: string) => void
  clearOrder: () => void
  totalPrice: number
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

  const addToOrder = useCallback(
    (item: MenuItem, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => {
      setItems((prev) => {
        const existing = prev.find((oi) => oi.menuItem.id === item.id)
        if (existing) {
          return prev.map((oi) =>
            oi.menuItem.id === item.id
              ? { ...oi, starch, vegetable, quantity: Math.min(oi.quantity + 1, platesFor(item)) }
              : oi,
          )
        }
        return [...prev, { menuItem: item, quantity: 1, starch, vegetable }]
      })
    },
    [],
  )

  const updateQuantity = useCallback((menuId: string, delta: number) => {
    setItems((prev) =>
      prev.flatMap((oi) => {
        if (oi.menuItem.id !== menuId) return [oi]
        const next = oi.quantity + delta
        if (next <= 0) return []
        return [{ ...oi, quantity: Math.min(next, platesFor(oi.menuItem)) }]
      }),
    )
  }, [])

  const updateAccompaniments = useCallback(
    (menuId: string, starch: OrderAccompaniment | null, vegetable: OrderAccompaniment | null) => {
      setItems((prev) =>
        prev.map((oi) => (oi.menuItem.id === menuId ? { ...oi, starch, vegetable } : oi)),
      )
    },
    [],
  )

  const removeItem = useCallback((menuId: string) => {
    setItems((prev) => prev.filter((oi) => oi.menuItem.id !== menuId))
  }, [])

  const clearOrder = useCallback(() => {
    setItems([])
  }, [])

  const totalPrice = useMemo(() => {
    return items.reduce((sum, oi) => sum + linePrice(oi), 0)
  }, [items])

  const value = useMemo(
    () => ({ items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice }),
    [items, addToOrder, updateAccompaniments, updateQuantity, removeItem, clearOrder, totalPrice],
  )

  return <WaiterOrderContext.Provider value={value}>{children}</WaiterOrderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWaiterOrder() {
  const ctx = useContext(WaiterOrderContext)
  if (!ctx) throw new Error("useWaiterOrder must be used within a WaiterOrderProvider")
  return ctx
}
