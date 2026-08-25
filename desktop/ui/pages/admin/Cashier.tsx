import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Search, Eye, Ban, CreditCard } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getOrders, voidOrder, updateOrderPayment } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

function money(amount: number): string {
  return `KSH ${amount.toLocaleString("en-KE")}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })
}

function StatusBadge({ isPaid }: { isPaid: boolean }) {
  return isPaid ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      Paid
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
      Unpaid
    </span>
  )
}

const COLUMNS: Column[] = [
  { label: "Mark Payment", key: "markPayment" },
  { label: "Order #", key: "orderNumber" },
  { label: "Meal", key: "mealType" },
  { label: "Payment", key: "paymentMethod" },
  { label: "Total", key: "totalPrice", align: "right" },
  { label: "Status", key: "status" },
  { label: "Date", key: "createdAt" },
  { label: "Actions", key: "details", isAction: true },
]

function Cashier() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState<number | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [voidOrderData, setVoidOrderData] = useState<Order | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voiding, setVoiding] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
  const [collectingPayment, setCollectingPayment] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      setLoading(true)
      setError("")
      try {
        const data = await getOrders(searchQuery ?? undefined)
        if (!cancelled) setOrders(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrders()
    return () => {
      cancelled = true
    }
  }, [searchQuery])

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = searchInput.trim()
    setSearchQuery(trimmed === "" ? null : Number(trimmed))
  }

  function handleClearSearch() {
    setSearchInput("")
    setSearchQuery(null)
  }

  async function handleVoidOrder() {
    if (!voidOrderData || !user) return
    setVoiding(true)
    try {
      await voidOrder(voidOrderData.id, user.id, voidReason || undefined)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === voidOrderData.id
            ? { ...o, isVoid: true, voidReason, voidedAt: new Date().toISOString() }
            : o
        )
      )
      setVoidOrderData(null)
      setVoidReason("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void order")
    } finally {
      setVoiding(false)
    }
  }

  async function handleCollectPayment(method: "cash" | "mpesa") {
    if (!paymentOrder) return
    setCollectingPayment(true)
    try {
      await updateOrderPayment(paymentOrder.id, method)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === paymentOrder.id
            ? { ...o, paymentMethod: method, isPaid: true, paidAt: new Date().toISOString() }
            : o
        )
      )
      setPaymentOrder(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment")
    } finally {
      setCollectingPayment(false)
    }
  }

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "markPayment":
        if (order.isPaid) {
          if (order.paymentMethod === "mpesa") {
            return (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Paid
              </span>
            )
          }
          return (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
              Paid
            </span>
          )
        }
        return (
          <Button
            variant="default"
            size="sm"
            onClick={() => setPaymentOrder(order)}
          >
            <CreditCard />
            Pay
          </Button>
        )
      case "orderNumber":
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">#{order.orderNumber}</span>
            {order.isVoid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                VOIDED
              </span>
            )}
          </div>
        )
      case "mealType":
        return order.mealType
      case "paymentMethod":
        if (!order.isPaid) {
          return <span className="text-admin-muted">Unpaid</span>
        }
        if (order.paymentMethod === "mpesa") {
          return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">M-Pesa</span>
        }
        return <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Cash</span>
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "status":
        return <StatusBadge isPaid={order.isPaid} />
      case "createdAt":
        return formatDate(order.createdAt)
      case "details":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailOrder(order)}
            >
              <Eye />
              Details
            </Button>
            {!order.isVoid && !order.isPaid && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setVoidOrderData(order)}
              >
                <Ban />
                Void
              </Button>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">
        Cashier
      </Heading>

      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={COLUMNS}
        data={orders}
        renderCell={renderCell}
        keyExtractor={(order) => order.id}
        emptyMessage="No orders found"
        header={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Heading as="h2" className="text-lg text-admin-header-text">
              Orders
            </Heading>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                <Input
                  placeholder="Search by order number"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-56 pl-8"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
              {searchQuery !== null && (
                <Button type="button" variant="ghost" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
            </form>
          </div>
        }
      />

      <Dialog open={detailOrder !== null} onOpenChange={(open) => { if (!open) setDetailOrder(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{detailOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Order details and items</DialogDescription>
          </DialogHeader>

          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="text-admin-muted">Meal</div>
                <div className="font-medium">{detailOrder.mealType}</div>
                <div className="text-admin-muted">Waiter</div>
                <div className="font-medium">{detailOrder.User?.name ?? "—"}</div>
                <div className="text-admin-muted">Date</div>
                <div className="font-medium">{formatDate(detailOrder.createdAt)}</div>
                <div className="text-admin-muted">Payment</div>
                <div className="font-medium">{detailOrder.paymentMethod}</div>
                <div className="text-admin-muted">Status</div>
                <div className="font-medium">
                  <StatusBadge isPaid={detailOrder.isPaid} />
                </div>
              </div>

              <div className="space-y-2">
                {detailOrder.OrderItem.map((item) => {
                  const accomp = [item.Starch?.name, item.Vegetable?.name].filter(Boolean).join(", ")
                  return (
                    <div
                      key={`${item.orderId}-${item.menuId}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-admin-card-border p-3"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-admin-muted">
                          {item.qty} x {money(item.price)}
                          {accomp ? ` — ${accomp}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold">{money(item.qty * item.price)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-admin-accent/10 p-4">
                <span className="font-medium text-admin-header-text">Total</span>
                <span className="text-lg font-bold text-admin-header-text">{money(detailOrder.totalPrice)}</span>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Void Order Dialog */}
      <Dialog open={voidOrderData !== null} onOpenChange={(open) => { if (!open) { setVoidOrderData(null); setVoidReason("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Void Order #{voidOrderData?.orderNumber}</DialogTitle>
            <DialogDescription>
              This will void the entire order and restore all items to stock. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {voidOrderData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-admin-muted">Waiter</div>
                  <div className="font-medium">{voidOrderData.User?.name ?? "—"}</div>
                  <div className="text-admin-muted">Total</div>
                  <div className="font-medium">{money(voidOrderData.totalPrice)}</div>
                  <div className="text-admin-muted">Items</div>
                  <div className="font-medium">{voidOrderData.OrderItem.length}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-admin-header-text">Reason (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {["Customer changed order", "Wrong item served", "Other"].map((reason) => (
                    <Button
                      key={reason}
                      type="button"
                      variant={voidReason === reason ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoidReason(voidReason === reason ? "" : reason)}
                    >
                      {reason}
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setVoidOrderData(null); setVoidReason("") }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleVoidOrder}
                  disabled={voiding}
                >
                  {voiding ? "Voiding..." : "Confirm Void"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collect Payment Dialog */}
      <Dialog open={paymentOrder !== null} onOpenChange={(open) => { if (!open) setPaymentOrder(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              Order #{paymentOrder?.orderNumber} — {paymentOrder && money(paymentOrder.totalPrice)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-3 h-14 text-base"
              disabled={collectingPayment}
              onClick={() => handleCollectPayment("mpesa")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                M
              </span>
              M-Pesa
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-3 h-14 text-base"
              disabled={collectingPayment}
              onClick={() => handleCollectPayment("cash")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                C
              </span>
              Cash
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPaymentOrder(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Cashier
