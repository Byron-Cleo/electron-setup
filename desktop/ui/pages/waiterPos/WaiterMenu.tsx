import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { getMenuByMealType } from "@/lib/api"
import { useWaiterOrder } from "./WaiterOrderContext"
import WaiterMenuGrid from "./WaiterMenuGrid"

export function WaiterMenu() {
  const { mealPeriod } = useParams<{ mealPeriod: string }>()
  const { items: orderItems, clearOrder } = useWaiterOrder()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)

  if (loadedPeriod !== (mealPeriod ?? null)) {
    setLoadedPeriod(mealPeriod ?? null)
    setItems([])
    setError(null)
    setLoading(true)
  }

  useEffect(() => {
    if (!mealPeriod) return

    let cancelled = false

    getMenuByMealType(mealPeriod)
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load menu items")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mealPeriod])

  function placeOrder() {
    setItems((prev) =>
      prev.map((m) => {
        const line = orderItems.find((oi) => oi.menuItem.id === m.id)
        if (!line) return m
        return { ...m, stock: Math.max(0, m.stock - line.quantity) }
      }),
    )
    clearOrder()
  }

  return (
    <WaiterMenuGrid
      mealPeriod={mealPeriod ?? ""}
      items={items}
      loading={loading}
      error={error}
      onPlaceOrder={placeOrder}
    />
  )
}

export default WaiterMenu
