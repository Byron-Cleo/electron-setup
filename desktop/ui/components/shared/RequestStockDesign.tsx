import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import { stockSupplyImageUrl, formatQuantityWithUnit } from "@/lib/api"
import { getStockRequests } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { FulfillItemDialog } from "@/components/store/FulfillItemDialog"
import { ShoppingBasket } from "lucide-react"

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
  /** Callback when a request is fulfilled */
  onRequestFulfilled?: () => void
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

const ALL_COLUMNS: Column[] = [
  { label: "Image", key: "image", align: "center" },
  { label: "Name", key: "name", align: "left" },
  { label: "Requested", key: "requested", align: "center" },
  { label: "Delivered", key: "delivered", align: "center" },
  { label: "Request Status", key: "status", align: "center" },
  { label: "Department", key: "department", align: "left" },
  { label: "Requested By", key: "requestedBy", align: "left" },
  { label: "Action", key: "action", isAction: true },
]

export function RequestStockDesign({
  department,
  showDepartmentColumn = true,
  showActionColumn = true,
  onRequestFulfilled,
}: RequestStockDesignProps) {
  const [activeTab, setActiveTab] = useState<TabStatus>("ALL")
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [fulfillingItem, setFulfillingItem] = useState<FlatItem | null>(null)

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
    return source.flatMap((request) =>
      request.items.map((item) => ({ item, request }))
    )
  }, [requests, activeTab, department])

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
      return true
    })
  }, [showDepartmentColumn, showActionColumn])

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
      case "status": {
        const config = STATUS_CONFIG[request.status]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
          </span>
        )
      }
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
      <Heading as="h2" className="text-admin-header-text">Stock Requests</Heading>

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
    </div>
  )
}
