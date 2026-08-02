import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Search, Eye } from "lucide-react"
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
import { getOrders } from "@/lib/api"

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
  { label: "Order #", key: "orderNumber" },
  { label: "Meal", key: "mealType" },
  { label: "Payment", key: "paymentMethod" },
  { label: "Total", key: "totalPrice", align: "right" },
  { label: "Status", key: "status" },
  { label: "Date", key: "createdAt" },
  { label: "", key: "details", isAction: true },
]

function Cashier() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState<number | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

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

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return <span className="font-semibold">#{order.orderNumber}</span>
      case "mealType":
        return order.mealType
      case "paymentMethod":
        return order.paymentMethod
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "status":
        return <StatusBadge isPaid={order.isPaid} />
      case "createdAt":
        return formatDate(order.createdAt)
      case "details":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailOrder(order)}
          >
            <Eye />
            Details
          </Button>
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
    </div>
  )
}

export default Cashier
