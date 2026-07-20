import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import { stockSupplyImageUrl, formatQuantityWithUnit } from "@/lib/api"
import { getStockRequests } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { FulfillItemDialog } from "./FulfillItemDialog"
import { ShoppingBasket } from "lucide-react"

type TabStatus = "ALL" | "PENDING" | "PARTIAL" | "COMPLETED"

interface FlatItem {
  item: StockRequestItem
  request: StockRequest
}

interface Props {
  onRequestFulfilled: () => void
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

const COLUMNS: Column[] = [
  { label: "Image", key: "image", align: "center" },
  { label: "Name", key: "name", align: "left" },
  { label: "Requested", key: "requested", align: "center" },
  { label: "Delivered", key: "delivered", align: "center" },
  { label: "Request Status", key: "status", align: "center" },
  { label: "Department", key: "department", align: "left" },
  { label: "Requested By", key: "requestedBy", align: "left" },
  { label: "Action", key: "action", isAction: true },
]

export function StockRequestsList({ onRequestFulfilled }: Props) {
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
    const source =
      activeTab === "ALL"
        ? requests
        : requests.filter((r) => r.status === activeTab)
    return source.flatMap((request) =>
      request.items.map((item) => ({ item, request }))
    )
  }, [requests, activeTab])

  const counts = {
    ALL: requests.length,
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    PARTIAL: requests.filter((r) => r.status === "PARTIAL").length,
    COMPLETED: requests.filter((r) => r.status === "COMPLETED").length,
  }

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
    onRequestFulfilled()
  }

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Stock Requests</Heading>

      {/* Tabs */}
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
          columns={COLUMNS}
          data={paginatedItems}
          keyExtractor={(fi) => fi.item.id}
          emptyMessage="No stock request items found"
          renderCell={(fi, column) => {
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
                return request.status !== "COMPLETED" ? (
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
          }}
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

      {fulfillingItem && (
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
