import { useState, useEffect, useRef } from "react"
import { useParams } from "react-router-dom"
import { TriangleAlert } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getMenuByMealType, createOrder, printReceipt, previewReceipt, getOrderCount, getCurrentShift } from "@/lib/api"
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

function buildReceipt(
  order: Order,
  orderItems: OrderLineItem[],
  waiterName: string,
  mealType: string,
  replacesOrderNumber?: number,
): ReceiptData {
  const items = toReceiptItems(orderItems)
  const itemsPrice = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const shippingPrice = Number(order.shippingPrice) || 0
  const taxPrice = Number(order.taxPrice) || 0

  return {
    ticket: "customer",
    order: {
      id: order.id,
      number: order.orderNumber,
      mealType,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      ...(replacesOrderNumber != null ? { replacesOrderNumber } : {}),
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
      shippingPrice,
      taxPrice,
      totalPrice: itemsPrice + shippingPrice + taxPrice,
    },
    barcode: String(order.orderNumber),
  }
}

function buildPreviewReceipt(
  orderItems: OrderLineItem[],
  waiterName: string,
  mealType: string,
  nextNumber: number,
  replacesOrderNumber?: number,
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
      ...(replacesOrderNumber != null ? { replacesOrderNumber } : {}),
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
  const {
    items: orderItems,
    clearOrder,
    voidedOrders,
    clearVoidedOrder,
    replacementTargetId,
    setReplacementTargetId,
    prefillFromVoid,
  } = useWaiterOrder()
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
  const [noShift, setNoShift] = useState(false)
  const prefilledRef = useRef<string | null>(null)

  // Block ordering when no shift is open — poll so waiters recover automatically.
  useEffect(() => {
    let cancelled = false
    function checkShift() {
      getCurrentShift()
        .then((s) => {
          if (!cancelled) setNoShift(!s)
        })
        .catch(() => {
          if (!cancelled) setNoShift(true)
        })
    }
    checkShift()
    const id = setInterval(checkShift, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const replacementOrder = voidedOrders.find((o) => o.id === replacementTargetId)

  // Preload the cart with the targeted voided order's items once per selection
  useEffect(() => {
    if (!replacementTargetId || !replacementOrder) return
    if (prefilledRef.current === replacementTargetId) return
    prefilledRef.current = replacementTargetId
    prefillFromVoid(replacementOrder)
  }, [replacementTargetId, replacementOrder, prefillFromVoid])

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

    // Initial load (full loading state)
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

    // Poll every 5s to pick up menu changes (availability/stock) in near-realtime
    const id = setInterval(() => {
      getMenuByMealType(mealPeriod)
        .then((data) => {
          if (cancelled) return
          setItems(data)
        })
        .catch(() => {
          // Silent — keep showing last good data
        })
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [mealPeriod])

  async function placeOrder() {
    if (!user || orderItems.length === 0 || !mealPeriod) return
    setPlacing(true)
    setPlaceError(null)
    // Replacement flow: link the new order to the targeted voided order
    // (falls back to the oldest pending void when placing a normal order)
    const replacementForId = replacementTargetId ?? voidedOrders[0]?.id
    const replacesOrderNumber = replacementForId
      ? voidedOrders.find((o) => o.id === replacementForId)?.orderNumber
      : undefined
    try {
      const order = await createOrder({
        userId: user.id,
        items: buildOrderItems(orderItems),
        mealType: mealPeriod,
        ...(replacementForId ? { voidedOrderId: replacementForId } : {}),
      })
      if (replacementForId) {
        clearVoidedOrder(replacementForId)
      }
      setReplacementTargetId(null)
      prefilledRef.current = null
      const receipt = buildReceipt(order, orderItems, user.name, mealPeriod, replacesOrderNumber)
      const printResult = await printReceipt(receipt)
      if (!printResult.ok) {
        window.alert(
          `Order #${order.orderNumber} placed, but the receipt did not print.\n\n${printResult.error ?? "Unknown print error"}\n\nPlease check the printer config, then reprint the receipt for the order.`,
        )
      }
      const kitchenReceipt = { ...receipt, ticket: "kitchen" as const }
      const kitchenResult = await printReceipt(kitchenReceipt)
      if (!kitchenResult.ok) {
        window.alert(
          `Order #${order.orderNumber} placed, but the kitchen receipt did not print.\n\n${kitchenResult.error ?? "Unknown print error"}\n\nPlease check the kitchen printer config.`,
        )
      }
      clearOrder()
      await logout()
    } catch (err) {
      if (err instanceof Error && err.message.includes("No active shift")) {
        setNoShift(true)
      }
      setPlaceError(err instanceof Error ? err.message : "Failed to place order")
      setPlacing(false)
      // Auto-refresh menu grid after rejection (sold out / no shift updates)
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  async function handlePreview() {
    if (!user || orderItems.length === 0) return
    setPreviewing(true)
    setPreviewError(null)
    try {
      const count = await getOrderCount()
      // Mirror placeOrder's replacement resolution so preview == print
      const replacementForId = replacementTargetId ?? voidedOrders[0]?.id
      const replacesOrderNumber = replacementForId
        ? voidedOrders.find((o) => o.id === replacementForId)?.orderNumber
        : undefined
      const receipt = buildPreviewReceipt(orderItems, user.name, mealPeriod ?? "", count + 1, replacesOrderNumber)
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

  if (noShift) {
    return (
      <Card className="mx-auto mt-24 max-w-xl border-red-200 bg-red-50/40">
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <TriangleAlert className="h-10 w-10 text-red-600" />
          <p className="text-lg font-bold text-red-800">No Active Shift</p>
          <p className="text-sm text-red-700/80">
            There is a missed shift. Please alert the manager. Orders cannot be taken until a shift is open.
          </p>
        </CardContent>
      </Card>
    )
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
