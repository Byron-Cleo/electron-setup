import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { getMenuByMealType, createOrder, printReceipt, previewReceipt, getOrderCount } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useWaiterOrder } from "./WaiterOrderContext"
import WaiterMenuGrid from "./WaiterMenuGrid"

function toReceiptItems(orderItems: OrderLineItem[]): ReceiptItem[] {
  return orderItems.map((oi) => {
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
}

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
  const items = toReceiptItems(orderItems)

  return {
    ticket: "customer",
    order: {
      id: order.id,
      number: order.orderNumber,
      mealType,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
    },
    restaurant: {
      name: "ERAEVA CATERING SERVICES",
      branch: "Airport",
      address: "P.O BOX 75531-00200",
      city: "Nairobi",
      phone: "0712345678",
      tel: "0701315250",
      poweredBy: "Apydy Technologies",
      services: "Hotel Systems, Supermarket Systems, Web Design, Mobile Development",
    },
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

function buildPreviewReceipt(
  orderItems: OrderLineItem[],
  waiterName: string,
  mealType: string,
  nextNumber: number,
): ReceiptData {
  const items = toReceiptItems(orderItems)
  const itemsPrice = items.reduce((sum, item) => sum + item.lineTotal, 0)

  return {
    ticket: "customer",
    order: {
      id: "preview",
      number: nextNumber,
      mealType,
      createdAt: new Date().toISOString(),
      paymentMethod: "Cash",
    },
    restaurant: {
      name: "ERAEVA CATERING SERVICES",
      branch: "Airport",
      address: "P.O BOX 75531-00200",
      city: "Nairobi",
      phone: "0712345678",
      tel: "0701315250",
      poweredBy: "Apydy Technologies",
      services: "Hotel Systems, Supermarket Systems, Web Design, Mobile Development",
    },
    waiter: { name: waiterName },
    items,
    totals: {
      itemsPrice,
      shippingPrice: 0,
      taxPrice: 0,
      totalPrice: itemsPrice,
    },
    barcode: String(nextNumber),
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
  const [previewing, setPreviewing] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  if (loadedPeriod !== (mealPeriod ?? null)) {
    setLoadedPeriod(mealPeriod ?? null)
    setItems([])
    setError(null)
    setPlaceError(null)
    setPreviewError(null)
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
      const printResult = await printReceipt(receipt)
      if (!printResult.ok) {
        window.alert(
          `Order #${order.orderNumber} placed, but the receipt did not print.\n\n${printResult.error ?? "Unknown print error"}\n\nPlease check the printer config, then reprint the receipt for the order.`,
        )
      }
      clearOrder()
      await logout()
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order")
      setPlacing(false)
    }
  }

  async function handlePreview() {
    if (!user || orderItems.length === 0) return
    setPreviewing(true)
    setPreviewError(null)
    try {
      const count = await getOrderCount()
      const receipt = buildPreviewReceipt(orderItems, user.name, mealPeriod ?? "", count + 1)
      const html = await previewReceipt(receipt)
      setPreviewHtml(html)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to preview receipt")
    } finally {
      setPreviewing(false)
    }
  }

  function closePreview() {
    setPreviewHtml(null)
    setPreviewError(null)
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
      previewing={previewing}
      previewHtml={previewHtml}
      previewError={previewError}
      onPreview={handlePreview}
      onClosePreview={closePreview}
    />
  )
}

export default WaiterMenu
