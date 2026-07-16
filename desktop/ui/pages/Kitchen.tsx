import { useState, useEffect } from "react"
import { Package, Send, Clock, ArrowLeft, UtensilsCrossed } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/stores/auth"
import { getStockSupplies, getStockRequests, createStockRequest } from "@/lib/api"

type KitchenView = "dashboard" | "request-food"
type KitchenTab = "stock" | "history"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  PARTIAL: { label: "Partial", className: "bg-orange-100 text-orange-800" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-800" },
}

function Kitchen() {
  const user = useAuthStore((s) => s.user)
  const [view, setView] = useState<KitchenView>("dashboard")
  const [activeTab, setActiveTab] = useState<KitchenTab>("stock")

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-3xl text-admin-header-text">Kitchen</Heading>

      {view !== "dashboard" && (
        <div className="flex items-center justify-between mb-4">
          <Button onClick={() => setView("dashboard")} className="px-6 py-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      )}

      {view === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("request-food")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Send size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">Request Food / Items</Heading>
                <p className="text-sm text-admin-muted">Request stock items from store</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => {}}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UtensilsCrossed size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">Cooked Food</Heading>
                <p className="text-sm text-admin-muted">Manage prepared meals</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {view === "request-food" && (
        <div className="space-y-6">
          <div className="flex gap-1 border-b border-admin-card-border">
            {([
              { key: "stock", label: "Current Stock", icon: Package },
              { key: "history", label: "My Requests", icon: Clock },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "border-b-2 border-admin-accent text-admin-accent"
                    : "text-admin-muted hover:text-admin-header-text"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "stock" && user && <CurrentStockView userId={user.id} />}
          {activeTab === "history" && user && <MyRequestsView userId={user.id} />}
        </div>
      )}
    </div>
  )
}

function CurrentStockView({ userId }: { userId: string }) {
  const [items, setItems] = useState<StockSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requestDialog, setRequestDialog] = useState<{ open: boolean; item: StockSupply | null }>({
    open: false,
    item: null,
  })
  const [requestQty, setRequestQty] = useState(1)
  const [requestNotes, setRequestNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  async function loadStock() {
    try {
      setLoading(true)
      const data = await getStockSupplies()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  function openRequestDialog(item: StockSupply) {
    setRequestDialog({ open: true, item })
    setRequestQty(1)
    setRequestNotes("")
    setSubmitSuccess(false)
  }

  async function handleRequestSubmit() {
    if (!requestDialog.item || requestQty <= 0) return

    try {
      setSubmitting(true)
      setError("")
      await createStockRequest({
        requestedById: userId,
        department: "kitchen",
        notes: requestNotes || undefined,
        items: [{ stockSupplyId: requestDialog.item.id, quantityRequested: requestQty }],
      })
      setSubmitSuccess(true)
      setTimeout(() => {
        setRequestDialog({ open: false, item: null })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-admin-muted">Loading stock...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Available Stock</Heading>
      <div className="rounded-lg border border-admin-card-border bg-admin-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-card-border bg-admin-content">
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Name</th>
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Category</th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">Stock Level</th>
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Unit</th>
              <th className="text-center px-4 py-3 font-medium text-admin-header-text">Request Stock Item</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isLow = item.reorderLevel != null && item.currentStock <= item.reorderLevel
              return (
                <tr
                  key={item.id}
                  className={`border-b border-admin-card-border last:border-0 ${
                    isLow ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-admin-muted">{item.category.name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${isLow ? "text-red-600" : ""}`}>
                    {item.currentStock}
                  </td>
                  <td className="px-4 py-3 text-admin-muted">{item.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openRequestDialog(item)}
                    >
                      <Send size={14} className="mr-1" />
                      Request
                    </Button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-admin-muted">
                  No stock items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={requestDialog.open}
        onOpenChange={(open) => setRequestDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Stock Item</DialogTitle>
            <DialogDescription>
              Request {requestDialog.item?.name} from store
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <div className="py-4 text-center text-green-600 font-medium">
              Request submitted successfully!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requestQty">Quantity</Label>
                <Input
                  id="requestQty"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={requestQty}
                  onChange={(e) => setRequestQty(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-admin-muted">
                  Unit: {requestDialog.item?.unit} | Current stock: {requestDialog.item?.currentStock}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestNotes">Notes (optional)</Label>
                <Textarea
                  id="requestNotes"
                  placeholder="Any additional notes..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {!submitSuccess && (
              <>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleRequestSubmit} disabled={submitting || requestQty <= 0}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MyRequestsView({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function loadRequests() {
    try {
      setLoading(true)
      const all = await getStockRequests()
      setRequests(all.filter((r) => r.requestedById === userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [userId])

  if (loading) return <div className="text-admin-muted">Loading requests...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">My Requests</Heading>
      {requests.length === 0 && (
        <div className="text-center py-8 text-admin-muted">No requests yet</div>
      )}
      <div className="space-y-3">
        {requests.map((request) => {
          const config = STATUS_CONFIG[request.status]
          const isExpanded = expandedId === request.id
          return (
            <Card key={request.id} className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : request.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-admin-muted">
                    {new Date(request.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                    {config.label}
                  </span>
                </div>
                <span className="text-xs text-admin-muted">
                  {request.items.length} item{request.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-admin-card-border space-y-2">
                  {request.notes && (
                    <p className="text-sm text-admin-muted italic">{request.notes}</p>
                  )}
                  {request.items.map((item) => {
                    const delivered = Number(item.quantityDelivered)
                    const requested = Number(item.quantityRequested)
                    const isComplete = delivered >= requested
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <span>{item.stockSupply.name}</span>
                        <span className="text-admin-muted">—</span>
                        <span className={isComplete ? "text-green-600" : "text-orange-600"}>
                          {delivered} / {requested} {item.stockSupply.unit}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default Kitchen
