import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { ChevronDown, ChevronRight, CheckCircle } from "lucide-react"
import { getStockRequests } from "@/lib/api"
import { FulfillRequest } from "./FulfillRequest"

type TabStatus = "ALL" | "PENDING" | "PARTIAL" | "COMPLETED"

interface Props {
  onRequestFulfilled: () => void
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  PARTIAL: { label: "Partial", className: "bg-orange-100 text-orange-800" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-800" },
}

export function StockRequestsList({ onRequestFulfilled }: Props) {
  const [activeTab, setActiveTab] = useState<TabStatus>("ALL")
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [fulfillingRequest, setFulfillingRequest] = useState<StockRequest | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const filtered =
    activeTab === "ALL"
      ? requests
      : requests.filter((r) => r.status === activeTab)

  const counts = {
    ALL: requests.length,
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    PARTIAL: requests.filter((r) => r.status === "PARTIAL").length,
    COMPLETED: requests.filter((r) => r.status === "COMPLETED").length,
  }

  function handleFulfilled() {
    setFulfillingRequest(null)
    loadRequests()
    onRequestFulfilled()
  }

  if (fulfillingRequest) {
    return (
      <FulfillRequest
        request={fulfillingRequest}
        onBack={() => setFulfillingRequest(null)}
        onFulfilled={handleFulfilled}
      />
    )
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

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-8 text-admin-muted">No requests found</div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map((request) => {
            const config = STATUS_CONFIG[request.status]
            const isExpanded = expandedId === request.id
            const fulfillments = request.fulfillments ?? []
            return (
              <Card key={request.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-admin-header-text">
                        {request.requestedBy.name}
                      </span>
                      <span className="text-xs text-admin-muted">
                        {request.department}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-admin-muted">
                      {new Date(request.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {request.notes && (
                      <p className="text-sm text-admin-muted italic">{request.notes}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {request.items.map((item) => {
                        const delivered = Number(item.quantityDelivered)
                        const requested = Number(item.quantityRequested)
                        const isComplete = delivered >= requested
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span>{item.stockSupply.name}</span>
                            <span className="text-admin-muted">—</span>
                            <span className={isComplete ? "text-green-600" : "text-orange-600"}>
                              {delivered} / {requested} {item.stockSupply.unit}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Fulfillment Trail */}
                    {fulfillments.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          className="flex items-center gap-1 text-xs font-medium text-admin-accent hover:underline"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Fulfillment History ({fulfillments.length})
                        </button>
                        {isExpanded && (
                          <div className="mt-2 pl-4 border-l-2 border-admin-card-border space-y-3">
                            {fulfillments.map((fulfillment) => (
                              <div key={fulfillment.id} className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <CheckCircle size={12} className="text-green-600" />
                                  <span className="font-medium text-admin-header-text">
                                    Fulfilled by {fulfillment.fulfilledBy.name}
                                  </span>
                                  <span className="text-admin-muted">
                                    on {new Date(fulfillment.createdAt).toLocaleString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {fulfillment.notes && (
                                  <p className="text-xs text-admin-muted italic pl-5">
                                    Notes: {fulfillment.notes}
                                  </p>
                                )}
                                <div className="pl-5 space-y-0.5">
                                  {fulfillment.items.map((fi) => (
                                    <div key={fi.id} className="text-xs text-admin-muted">
                                      Delivered: {Number(fi.quantityDelivered)} units
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {request.status !== "COMPLETED" && (
                    <Button
                      size="sm"
                      onClick={() => setFulfillingRequest(request)}
                    >
                      Fulfill
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
