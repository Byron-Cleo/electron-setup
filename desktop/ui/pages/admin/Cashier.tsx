import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Eye, Ban, CreditCard, Receipt, XCircle, Wallet } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { usePagination } from "@/hooks/usePagination"
import BackButton from "@/components/shared/BackButton"

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

type CashierView = "dashboard" | "orders" | "void" | "payment"

type OrderTab = "ALL" | "MPESA" | "CASH" | "VOID" | "UNPAID"

const TAB_LABELS: Record<OrderTab, string> = {
  ALL: "All",
  MPESA: "M-Pesa",
  CASH: "Cash",
  VOID: "Void",
  UNPAID: "Unpaid",
}

const TAB_COLORS: Record<OrderTab, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-admin-accent text-admin-accent-text",
    inactive: "text-admin-muted hover:text-admin-header-text",
  },
  MPESA: {
    active: "bg-blue-100 text-blue-700",
    inactive: "text-blue-400 hover:text-blue-600",
  },
  CASH: {
    active: "bg-orange-100 text-orange-700",
    inactive: "text-orange-400 hover:text-orange-600",
  },
  VOID: {
    active: "bg-red-100 text-red-700",
    inactive: "text-red-400 hover:text-red-600",
  },
  UNPAID: {
    active: "bg-gray-100 text-gray-700",
    inactive: "text-gray-400 hover:text-gray-600",
  },
}

const ORDER_COLUMNS: Column[] = [
  { label: "Order #", key: "orderNumber" },
  { label: "Meal", key: "mealType" },
  { label: "Payment", key: "paymentMethod" },
  { label: "Total", key: "totalPrice", align: "right" },
  { label: "Status", key: "status" },
  { label: "Date", key: "createdAt" },
  { label: "Details", key: "details", isAction: true },
]

function Cashier() {
  const [view, setView] = useState<CashierView>("dashboard")

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">
        Cashier
      </Heading>

      {view !== "dashboard" && (
        <BackButton onClick={() => setView("dashboard")} />
      )}

      {view === "dashboard" && <DashboardView onNavigate={setView} />}
      {view === "orders" && <OrdersView />}
      {view === "void" && <VoidView />}
      {view === "payment" && <PaymentView />}
    </div>
  )
}

function DashboardView({ onNavigate }: { onNavigate: (v: CashierView) => void }) {
  const [counts, setCounts] = useState({ total: 0, unpaid: 0, voided: 0 })

  useEffect(() => {
    let cancelled = false
    getOrders()
      .then((data) => {
        if (cancelled) return
        setCounts({
          total: data.length,
          unpaid: data.filter((o) => !o.isPaid && !o.isVoid).length,
          voided: data.filter((o) => o.isVoid).length,
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card
        className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
        onClick={() => onNavigate("orders")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Receipt size={24} className="text-green-600" />
          </div>
          <div>
            <Heading as="h3" className="text-lg text-admin-header-text">Orders</Heading>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {counts.total} total
              </span>
              {counts.unpaid > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                  {counts.unpaid} unpaid
                </span>
              )}
            </div>
            <p className="text-xs text-admin-muted mt-1">View all orders with filters and search.</p>
          </div>
        </div>
      </Card>

      <Card
        className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
        onClick={() => onNavigate("void")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
            <XCircle size={24} className="text-red-600" />
          </div>
          <div>
            <Heading as="h3" className="text-lg text-admin-header-text">Void Order</Heading>
            <div className="flex items-center gap-2 mt-1">
              {counts.unpaid > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {counts.unpaid} voidable
                </span>
              ) : (
                <span className="text-sm text-admin-muted">No voidable orders</span>
              )}
            </div>
            <p className="text-xs text-admin-muted mt-1">Select and void an unpaid order.</p>
          </div>
        </div>
      </Card>

      <Card
        className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
        onClick={() => onNavigate("payment")}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Wallet size={24} className="text-blue-600" />
          </div>
          <div>
            <Heading as="h3" className="text-lg text-admin-header-text">Payment</Heading>
            <div className="flex items-center gap-2 mt-1">
              {counts.unpaid > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {counts.unpaid} unpaid
                </span>
              ) : (
                <span className="text-sm text-admin-muted">All orders paid</span>
              )}
            </div>
            <p className="text-xs text-admin-muted mt-1">Mark an order as paid via M-Pesa or Cash.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<OrderTab>("ALL")

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      setError("")
      try {
        const data = await getOrders()
        if (!cancelled) setOrders(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let source = orders
    switch (activeTab) {
      case "MPESA":
        source = source.filter((o) => o.isPaid && o.paymentMethod === "mpesa")
        break
      case "CASH":
        source = source.filter((o) => o.isPaid && o.paymentMethod === "cash")
        break
      case "VOID":
        source = source.filter((o) => o.isVoid)
        break
      case "UNPAID":
        source = source.filter((o) => !o.isPaid && !o.isVoid)
        break
    }
    if (searchInput) {
      const q = searchInput.toLowerCase()
      source = source.filter((o) => String(o.orderNumber).includes(q))
    }
    return source
  }, [orders, activeTab, searchInput])

  const counts = useMemo(() => ({
    ALL: orders.length,
    MPESA: orders.filter((o) => o.isPaid && o.paymentMethod === "mpesa").length,
    CASH: orders.filter((o) => o.isPaid && o.paymentMethod === "cash").length,
    VOID: orders.filter((o) => o.isVoid).length,
    UNPAID: orders.filter((o) => !o.isPaid && !o.isVoid).length,
  }), [orders])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
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
          <Button variant="outline" size="sm" onClick={() => setDetailOrder(order)}>
            <Eye />
            Details
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Orders</Heading>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "MPESA", "CASH", "VOID", "UNPAID"] as OrderTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === tab
                ? TAB_COLORS[tab].active
                : `bg-gray-50 ${TAB_COLORS[tab].inactive}`
            }`}
          >
            {TAB_LABELS[tab]}
            <span className="ml-1.5 opacity-70">({counts[tab]})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <DataTable
          columns={ORDER_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <Input
              placeholder="Search by order number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-sm"
            />
          }
        />
      )}

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
    </div>
  )
}

function VoidView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voiding, setVoiding] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      try {
        const data = await getOrders()
        if (!cancelled) setOrders(data.filter((o) => !o.isPaid && !o.isVoid))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!searchInput) return orders
    const q = searchInput.toLowerCase()
    return orders.filter((o) => String(o.orderNumber).includes(q))
  }, [orders, searchInput])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  async function handleVoidOrder() {
    if (!selectedOrder || !user) return
    setVoiding(true)
    try {
      await voidOrder(selectedOrder.id, user.id, voidReason || undefined)
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
      setSelectedOrder(null)
      setVoidReason("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void order")
    } finally {
      setVoiding(false)
    }
  }

  const VOID_COLUMNS: Column[] = [
    { label: "Order #", key: "orderNumber" },
    { label: "Meal", key: "mealType" },
    { label: "Waiter", key: "waiter" },
    { label: "Total", key: "totalPrice", align: "right" },
    { label: "Date", key: "createdAt" },
    { label: "Action", key: "action", isAction: true },
  ]

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return <span className="font-semibold">#{order.orderNumber}</span>
      case "mealType":
        return order.mealType
      case "waiter":
        return order.User?.name ?? "—"
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "createdAt":
        return formatDate(order.createdAt)
      case "action":
        return (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setSelectedOrder(order)}
          >
            <Ban />
            Void
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Void Order</Heading>

      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <DataTable
          columns={VOID_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No voidable orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <Input
              placeholder="Search by order number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-sm"
            />
          }
        />
      )}

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setVoidReason("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Void Order #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              This will void the entire order and restore all items to stock. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-admin-muted">Waiter</div>
                  <div className="font-medium">{selectedOrder.User?.name ?? "—"}</div>
                  <div className="text-admin-muted">Total</div>
                  <div className="font-medium">{money(selectedOrder.totalPrice)}</div>
                  <div className="text-admin-muted">Items</div>
                  <div className="font-medium">{selectedOrder.OrderItem.length}</div>
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
                  onClick={() => { setSelectedOrder(null); setVoidReason("") }}
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
    </div>
  )
}

function PaymentView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [collectingPayment, setCollectingPayment] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      try {
        const data = await getOrders()
        if (!cancelled) setOrders(data.filter((o) => !o.isPaid && !o.isVoid))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!searchInput) return orders
    const q = searchInput.toLowerCase()
    return orders.filter((o) => String(o.orderNumber).includes(q))
  }, [orders, searchInput])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  async function handleCollectPayment(method: "cash" | "mpesa") {
    if (!selectedOrder) return
    setCollectingPayment(true)
    try {
      await updateOrderPayment(selectedOrder.id, method)
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
      setSelectedOrder(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment")
    } finally {
      setCollectingPayment(false)
    }
  }

  const PAYMENT_COLUMNS: Column[] = [
    { label: "Order #", key: "orderNumber" },
    { label: "Meal", key: "mealType" },
    { label: "Waiter", key: "waiter" },
    { label: "Total", key: "totalPrice", align: "right" },
    { label: "Date", key: "createdAt" },
    { label: "Action", key: "action", isAction: true },
  ]

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return <span className="font-semibold">#{order.orderNumber}</span>
      case "mealType":
        return order.mealType
      case "waiter":
        return order.User?.name ?? "—"
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "createdAt":
        return formatDate(order.createdAt)
      case "action":
        return (
          <Button
            size="sm"
            className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
            onClick={() => setSelectedOrder(order)}
          >
            <CreditCard />
            Pay
          </Button>
        )
    }
  }

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Payment</Heading>

      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <DataTable
          columns={PAYMENT_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No unpaid orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <Input
              placeholder="Search by order number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-sm"
            />
          }
        />
      )}

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => { if (!open) setSelectedOrder(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.orderNumber} — {selectedOrder && money(selectedOrder.totalPrice)}
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
            <Button type="button" variant="ghost" onClick={() => setSelectedOrder(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Cashier
