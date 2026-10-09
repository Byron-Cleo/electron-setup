import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { stockSupplyImageUrl, formatQuantityWithUnit, getStockRequests, adjustStockRequest } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { usePagination } from "@/hooks/usePagination"
import { FulfillItemDialog } from "@/components/store/FulfillItemDialog"
import { useAuthStore } from "@/stores/auth"
import { Pencil, ShoppingBasket } from "lucide-react"

type TabStatus = "ALL" | "PENDING" | "PARTIAL" | "COMPLETED"

interface FlatItem {
  item: StockRequestItem
  request: StockRequest
}

interface RequestStockDesignProps {
  /** Filter requests by department. If undefined, shows all departments */
  department?: string
  /** Show the Department column. Default: true */
  showDepartmentColumn?: boolean
  /** Show the Action column (Fulfill button). Default: true */
  showActionColumn?: boolean
  /** Show the Adjust column — kitchen edits requested amounts while stock is still raw. Default: false */
  allowAdjust?: boolean
  /** Callback when a request is fulfilled */
  onRequestFulfilled?: () => void
  /** Table title */
  title?: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-status-pending-bg text-status-pending-text" },
  PARTIAL: { label: "Partial", className: "bg-status-partial-bg text-status-partial-text" },
  COMPLETED: { label: "Completed", className: "bg-status-completed-bg text-status-completed-text" },
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  PENDING: "text-yellow-500",
  PARTIAL: "text-status-partial-text",
  COMPLETED: "text-status-completed-text",
}

/**
 * Adjust lock: pending/partial requests are always adjustable; a completed
 * request only stays adjustable through the day it was last touched
 * (updatedAt, Nairobi date). Completed on a past date is closed history.
 */
function isAdjustableRequest(request: StockRequest): boolean {
  if (request.status !== "COMPLETED") return true
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
  const touched = new Date(request.updatedAt).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
  return touched === today
}

const ALL_COLUMNS: Column[] = [
  { label: "Image", key: "image", align: "center" },
  { label: "Name", key: "name", align: "left" },
  { label: "Requested", key: "requested", align: "center", className: "bg-blue-100" },
  { label: "Delivered", key: "delivered", align: "center", className: "bg-gray-100" },
  { label: "Remaining", key: "remaining", align: "center", className: "bg-green-100" },
  { label: "Request Status", key: "status", align: "center" },
  { label: "Department", key: "department", align: "left" },
  { label: "Requested By", key: "requestedBy", align: "left" },
  { label: "Req. Date", key: "reqDate", align: "left" },
  { label: "Adjust", key: "adjust", isAction: true, align: "center", className: "bg-red-100" },
  { label: "Action", key: "action", isAction: true, align: "center" },
]

export function RequestStockDesign({
  department,
  showDepartmentColumn = true,
  showActionColumn = true,
  allowAdjust = false,
  onRequestFulfilled,
  title = "Stock Requests",
}: RequestStockDesignProps) {
  const [activeTab, setActiveTab] = useState<TabStatus>("ALL")
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [fulfillingItem, setFulfillingItem] = useState<FlatItem | null>(null)
  const [adjustingItem, setAdjustingItem] = useState<FlatItem | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      setLoading(true)
      const data = await getStockRequests()
      setRequests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let source = requests
    if (department) {
      source = source.filter((r) => r.department === department)
    }
    if (activeTab !== "ALL") {
      source = source.filter((r) => r.status === activeTab)
    }
    const flat = source.flatMap((request) =>
      request.items.map((item) => ({ item, request }))
    )
    if (!search) return flat
    return flat.filter((fi) =>
      fi.item.stockSupply.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [requests, activeTab, department, search])

  const counts = useMemo(() => {
    const base = department
      ? requests.filter((r) => r.department === department)
      : requests
    return {
      ALL: base.length,
      PENDING: base.filter((r) => r.status === "PENDING").length,
      PARTIAL: base.filter((r) => r.status === "PARTIAL").length,
      COMPLETED: base.filter((r) => r.status === "COMPLETED").length,
    }
  }, [requests, department])

  const columns = useMemo(() => {
    return ALL_COLUMNS.filter((col) => {
      if (col.key === "department" && !showDepartmentColumn) return false
      if (col.key === "action" && !showActionColumn) return false
      if (col.key === "adjust" && !allowAdjust) return false
      return true
    })
  }, [showDepartmentColumn, showActionColumn, allowAdjust])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  function handleFulfilled() {
    setFulfillingItem(null)
    loadRequests()
    onRequestFulfilled?.()
  }

  function renderCell(fi: FlatItem, column: Column) {
    const { item, request } = fi
    const delivered = Number(item.quantityDelivered)
    const requested = Number(item.quantityRequested)
    const imageUrl = stockSupplyImageUrl(item.stockSupply.image)

    switch (column.key) {
      case "requestedBy":
        return (
          <span className="font-medium text-admin-header-text">
            {request.requestedBy.name}
          </span>
        )
      case "reqDate":
        return (
          <span className="text-admin-muted text-sm">
            {formatDate(request.createdAt)}
          </span>
        )
      case "department":
        return (
          <span className="text-admin-muted">{request.department}</span>
        )
      case "image":
        return imageUrl ? (
          <img
            src={imageUrl}
            alt={item.stockSupply.name}
            className="w-10 h-10 rounded object-cover mx-auto"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-admin-content flex items-center justify-center text-admin-muted text-xs mx-auto">
            N/A
          </div>
        )
      case "name":
        return (
          <span className="font-medium text-admin-header-text">
            {item.stockSupply.name}
          </span>
        )
      case "requested":
        return (
          <span>{formatQuantityWithUnit(requested, item.stockSupply.unit)}</span>
        )
      case "delivered":
        return (
          <span className={STATUS_TEXT_COLOR[request.status]}>
            {formatQuantityWithUnit(delivered, item.stockSupply.unit)}
          </span>
        )
      case "remaining":
        return (
          <span className={requested - delivered > 0 ? "font-medium text-amber-600" : "text-admin-muted"}>
            {formatQuantityWithUnit(requested - delivered, item.stockSupply.unit)}
          </span>
        )
      case "status": {
        const config = STATUS_CONFIG[request.status]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
          </span>
        )
      }
      case "adjust":
        return allowAdjust && isAdjustableRequest(request) ? (
          <Button
            size="sm"
            variant="outline"
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={(e) => {
              e.stopPropagation()
              setAdjustingItem(fi)
            }}
          >
            <Pencil size={14} className="mr-1" />
            Adjust
          </Button>
        ) : null
      case "action":
        return showActionColumn && request.status !== "COMPLETED" ? (
          <Button
            size="sm"
            className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
            onClick={(e) => {
              e.stopPropagation()
              setFulfillingItem(fi)
            }}
          >
            <ShoppingBasket size={14} className="mr-1" />
            Fulfill
          </Button>
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center text-xl">{title}</Heading>

      <div className="flex gap-1 border-b border-admin-card-border">
        {(["ALL", "PENDING", "PARTIAL", "COMPLETED"] as TabStatus[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-admin-accent text-admin-accent"
                : "text-admin-muted hover:text-admin-header-text"
            }`}
          >
            {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            <span className="ml-1.5 text-xs">({counts[tab]})</span>
          </button>
        ))}
      </div>

      {loading && <div className="text-admin-muted">Loading requests...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          data={paginatedItems}
          keyExtractor={(fi) => fi.item.id}
          emptyMessage="No stock request items found"
          renderCell={renderCell}
          header={
            <Input
              placeholder="Search stock items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          }
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
        />
      )}

      {showActionColumn && fulfillingItem && (
        <FulfillItemDialog
          flatItem={fulfillingItem}
          open={!!fulfillingItem}
          onClose={() => setFulfillingItem(null)}
          onFulfilled={handleFulfilled}
        />
      )}

      {allowAdjust && adjustingItem && (
        <AdjustItemDialog
          flatItem={adjustingItem}
          open={!!adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onAdjusted={handleFulfilled}
        />
      )}
    </div>
  )
}

/**
 * Change a requested amount while the stock is still raw. Reducing above the
 * delivered amount refunds the store shelf automatically; reducing below it
 * returns the uncooked surplus via the backend's cap (cooked stock never
 * goes back); increasing is gated on store availability.
 */
function AdjustItemDialog({
  flatItem,
  open,
  onClose,
  onAdjusted,
}: {
  flatItem: FlatItem
  open: boolean
  onClose: () => void
  onAdjusted: () => void
}) {
  const { item, request } = flatItem
  const user = useAuthStore((s) => s.user)
  const [qty, setQty] = useState(Number(item.quantityRequested))
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const requested = Number(item.quantityRequested)
  const delivered = Number(item.quantityDelivered)
  const isImplicitReturn = qty < delivered

  async function handleSubmit() {
    if (!user) return
    try {
      setSubmitting(true)
      setError("")
      await adjustStockRequest(request.id, {
        adjustedById: user.id,
        notes: notes || undefined,
        items: [{ stockRequestItemId: item.id, quantityRequested: qty }],
      })
      onAdjusted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Requested Amount</DialogTitle>
          <DialogDescription>
            {item.stockSupply.name} — Order of stock still raw can be corrected up or down.
            Requested {formatQuantityWithUnit(requested, item.stockSupply.unit)},
            delivered {formatQuantityWithUnit(delivered, item.stockSupply.unit)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-qty">New quantity ({item.stockSupply.unit}) — decimals allowed</Label>
            <Input
              id="adjust-qty"
              type="number"
              min={0.01}
              step={0.01}
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
            />
            {isImplicitReturn ? (
              <p className="text-xs text-amber-600 font-medium">
                Below the delivered amount — {formatQuantityWithUnit(delivered - qty, item.stockSupply.unit)} of
                uncooked stock will be returned to the store automatically. Cooked stock can never go back.
              </p>
            ) : (
              <p className="text-xs text-admin-muted">
                Reducing refunds the un-delivered difference to the store shelf; increasing is allowed when the
                store has stock.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-notes">Notes (optional)</Label>
            <Input
              id="adjust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for the adjustment"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !user || qty <= 0}>
            {submitting ? "Adjusting..." : "Adjust"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
