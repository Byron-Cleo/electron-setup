import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { getMenuByMealType, createOrder, printReceipt } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useWaiterOrder } from "./WaiterOrderContext"
import WaiterMenuGrid from "./WaiterMenuGrid"

function buildOrderItems(orderItems: OrderLineItem[]): CreateOrderItemData[] {
  return orderItems.map((oi) => ({
    menuId: oi.menuItem.id,
    qty: oi.quantity,
    price: Number(oi.menuItem.price),
    name: oi.menuItem.name,
    slug: oi.menuItem.slug,
    image: oi.menuItem.images[0] ?? "",
    starchId: oi.starch?.id ?? null,
    vegetableId: oi.vegetable?.id ?? null,
  }))
}

function buildReceipt(order: Order, orderItems: OrderLineItem[], waiterName: string, mealType: string): ReceiptData {
  const items: ReceiptItem[] = orderItems.map((oi) => {
    const starch = oi.starch
    const vegetable = oi.vegetable
    const accompaniments: ReceiptAccompaniment[] = [
      ...(starch ? [{ name: starch.name, charged: Number(starch.price ?? 0) > 0, price: Number(starch.price ?? 0) }] : []),
      ...(vegetable ? [{ name: vegetable.name, charged: Number(vegetable.price ?? 0) > 0, price: Number(vegetable.price ?? 0) }] : []),
    ]
    const unitPrice = Number(oi.menuItem.price)
    const lineTotal =
      (unitPrice + Number(starch?.price ?? 0) + Number(vegetable?.price ?? 0)) * oi.quantity
    return { name: oi.menuItem.name, accompaniments, qty: oi.quantity, unitPrice, lineTotal }
  })

  return {
    ticket: "customer",
    order: {
      id: order.id,
      number: order.orderNumber,
      mealType,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
    },
    restaurant: { name: "Eraeva Catering Services" },
    waiter: { name: waiterName },
    items,
    totals: {
      itemsPrice: Number(order.itemsPrice),
      shippingPrice: Number(order.shippingPrice),
      taxPrice: Number(order.taxPrice),
      totalPrice: Number(order.totalPrice),
    },
    barcode: String(order.orderNumber),
  }
}

export function WaiterMenu() {
  const { mealPeriod } = useParams<{ mealPeriod: string }>()
  const { items: orderItems, clearOrder } = useWaiterOrder()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  if (loadedPeriod !== (mealPeriod ?? null)) {
    setLoadedPeriod(mealPeriod ?? null)
    setItems([])
    setError(null)
    setPlaceError(null)
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

  async function placeOrder() {
    if (!user || orderItems.length === 0 || !mealPeriod) return
    setPlacing(true)
    setPlaceError(null)
    try {
      const order = await createOrder({
        userId: user.id,
        items: buildOrderItems(orderItems),
        mealType: mealPeriod,
      })
      const receipt = buildReceipt(order, orderItems, user.name, mealPeriod)
      await printReceipt(receipt)
      clearOrder()
      await logout()
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order")
      setPlacing(false)
    }
  }

  return (
    <WaiterMenuGrid
      mealPeriod={mealPeriod ?? ""}
      items={items}
      loading={loading}
      error={error}
      placing={placing}
      placeError={placeError}
      onPlaceOrder={placeOrder}
    />
  )
}

export default WaiterMenu
