import { useState, useEffect, useMemo } from "react"
import { Package, Send, Clock, ArrowLeft, UtensilsCrossed, ChefHat, History, Eye, CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DataTable, type Column } from "@/components/ui/data-table"
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
import {
  getStockSupplies,
  getStockRequests,
  createStockRequest,
  getKitchenConfig,
  getCookingRecords,
  createCookingRecord,
  stockSupplyImageUrl,
  formatQuantityWithUnit,
} from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import StockSupplyDetailDialog from "@/components/admin/StockSupplyDetailDialog"

type KitchenView = "dashboard" | "request-food" | "cooked-food"
type RequestTab = "stock" | "history"
type CookedTab = "inventory" | "cooking-history"



type StockDisplayStatus = "Available" | "Not Available"
type RequestDisplayStatus = "Pending" | "Partial" | "Completed"

function computeStockStatus(stock: StockSupply): StockDisplayStatus {
  return stock.currentStock > 0 ? "Available" : "Not Available"
}

function computeRequestStatus(
  lastRequest: StockRequest | undefined
): RequestDisplayStatus | null {
  if (!lastRequest) return null
  switch (lastRequest.status) {
    case "PENDING":   return "Pending"
    case "PARTIAL":   return "Partial"
    case "COMPLETED": return "Completed"
    default:          return null
  }
}

function getLastRequestMap(requests: StockRequest[]): Map<string, StockRequestItem> {
  const map = new Map<string, StockRequestItem>()
  const sorted = [...requests].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  for (const req of sorted) {
    for (const item of req.items) {
      if (!map.has(item.stockSupplyId)) {
        map.set(item.stockSupplyId, item)
      }
    }
  }
  return map
}

function Kitchen() {
  const user = useAuthStore((s) => s.user)
  const [view, setView] = useState<KitchenView>("dashboard")
  const [activeTab, setActiveTab] = useState<RequestTab>("stock")
  const [cookedTab, setCookedTab] = useState<CookedTab>("inventory")

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
            onClick={() => setView("cooked-food")}
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

      {view === "cooked-food" && (
        <div className="space-y-6">
          <div className="flex gap-1 border-b border-admin-card-border">
            {([
              { key: "inventory", label: "Kitchen Inventory", icon: ChefHat },
              { key: "cooking-history", label: "Cooking History", icon: History },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCookedTab(key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  cookedTab === key
                    ? "border-b-2 border-admin-accent text-admin-accent"
                    : "text-admin-muted hover:text-admin-header-text"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {cookedTab === "inventory" && user && <KitchenInventoryView userId={user.id} />}
          {cookedTab === "cooking-history" && user && <CookingHistoryView userId={user.id} />}
        </div>
      )}
    </div>
  )
}

function CurrentStockView({ userId }: { userId: string }) {
  const [items, setItems] = useState<StockSupply[]>([])
  const [requests, setRequests] = useState<StockRequest[]>([])
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
  const [detailTarget, setDetailTarget] = useState<StockSupply | null>(null)

  async function loadStock() {
    try {
      setLoading(true)
      const [stockData, requestData] = await Promise.all([
        getStockSupplies(),
        getStockRequests(),
      ])
      setItems(stockData)
      setRequests(requestData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  const lastRequestMap = useMemo(() => getLastRequestMap(requests), [requests])

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
      await loadStock()
      setTimeout(() => {
        setRequestDialog({ open: false, item: null })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(items)

  const columns: Column[] = [
          { label: "Details", key: "details" },
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Stock", key: "stock" },
    { label: "Last Request", key: "lastRequest" },
          { label: "Actions", key: "actions", isAction: true },
  ]

  function renderCell(item: StockSupply, column: Column) {
    const isLow = item.reorderLevel != null && item.currentStock <= item.reorderLevel

    switch (column.key) {
      case "details":
        return (
          <Button variant="ghost" size="sm" onClick={() => setDetailTarget(item)}>
            <Eye className="h-4 w-4 mr-1" />
            Details
          </Button>
        )
      case "image":
        return item.image ? (
          <img src={stockSupplyImageUrl(item.image) ?? ""} alt="" className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 rounded bg-admin-content flex items-center justify-center">
            <Package size={16} className="text-admin-header-text/30" />
          </div>
        )
      case "name": {
        const lastItem = lastRequestMap.get(item.id)
        const lastReq = lastItem
          ? requests.find(r => r.id === lastItem.stockRequestId)
          : undefined
        const reqStatus = computeRequestStatus(lastReq)
        const stockStatus = computeStockStatus(item)
        return (
          <div className="flex items-center gap-2">
            <span>{item.name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              stockStatus === "Available"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}>
              {stockStatus}
            </span>
          </div>
        )
      }
      case "stock":
        return (
          <span className={`font-medium ${isLow ? "text-red-600" : ""}`}>
            {formatQuantityWithUnit(item.currentStock, item.unit)}
          </span>
        )
      case "lastRequest": {
        const lastItem = lastRequestMap.get(item.id)
        const lastReq = lastItem
          ? requests.find(r => r.id === lastItem.stockRequestId)
          : undefined
        const reqStatus = computeRequestStatus(lastReq)
        if (!reqStatus || !lastItem) {
          return <span className="text-admin-muted">—</span>
        }
        const qtyText = formatQuantityWithUnit(lastItem.quantityRequested, item.unit)
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">{qtyText}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              reqStatus === "Pending"
                ? "bg-yellow-100 text-yellow-700"
                : reqStatus === "Partial"
                ? "bg-blue-100 text-blue-700"
                : "bg-green-100 text-green-700"
            }`}>
              {reqStatus}
            </span>
          </div>
        )
      }
      case "actions":
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => openRequestDialog(item)}
          >
            <Send size={14} className="mr-1" />
            Request
          </Button>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading stock...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Available Stock</Heading>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No stock items found"
        rowClassName={(item) => {
          const isLow = item.reorderLevel != null && item.currentStock <= item.reorderLevel
          return isLow ? "bg-red-50" : ""
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

      <StockSupplyDetailDialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        supplyId={detailTarget?.id ?? null}
      />
    </div>
  )
}

function MyRequestsView({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"pending" | "partial" | "completed">("pending")

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

  const tabs = [
    { key: "pending" as const, label: "Pending", icon: Clock },
    { key: "partial" as const, label: "Partial", icon: Package },
    { key: "completed" as const, label: "Completed", icon: CheckCircle },
  ]

  const tabCounts = {
    pending: requests.filter((r) => r.status === "PENDING").length,
    partial: requests.filter((r) => r.status === "PARTIAL").length,
    completed: requests.filter((r) => r.status === "COMPLETED").length,
  }

  const filteredRequests = requests.filter((r) => {
    switch (activeTab) {
      case "pending":   return r.status === "PENDING"
      case "partial":   return r.status === "PARTIAL"
      case "completed": return r.status === "COMPLETED"
    }
  })

  const columns: Column[] = [
    { label: "Date", key: "date" },
    { label: "Items", key: "items" },
    { label: "Notes", key: "notes" },
    { label: "Details", key: "details", isAction: true },
  ]

  function renderCell(request: StockRequest, column: Column) {
    switch (column.key) {
      case "date":
        return (
          <span className="text-sm">
            {new Date(request.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )
      case "items":
        return (
          <span className="text-sm text-admin-muted">
            {request.items.length} item{request.items.length !== 1 ? "s" : ""}
          </span>
        )
      case "notes":
        return (
          <span className="text-sm text-admin-muted truncate max-w-[200px]">
            {request.notes || "—"}
          </span>
        )
      case "details":
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
          >
            <Eye size={14} className="mr-1" />
            {expandedId === request.id ? "Hide" : "Details"}
          </Button>
        )
      default:
        return null
    }
  }

  const expandedRequest = expandedId ? requests.find((r) => r.id === expandedId) : null

  if (loading) return <div className="text-admin-muted">Loading requests...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">My Requests</Heading>
      <div className="flex items-center gap-2 border-b border-admin-card-border">
        {tabs.map(({ key, label, icon: Icon }) => (
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
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-admin-content text-admin-muted">
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>
      {filteredRequests.length === 0 && (
        <div className="text-center py-8 text-admin-muted">
          No {activeTab} requests
        </div>
      )}
      {filteredRequests.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredRequests}
          renderCell={renderCell}
          keyExtractor={(request) => request.id}
          emptyMessage={`No ${activeTab} requests`}
        />
      )}
      {expandedRequest && (
        <Card className="p-4 mt-2">
          <Heading as="h3" className="text-sm font-medium text-admin-header-text mb-3">
            Request Details — {new Date(expandedRequest.createdAt).toLocaleDateString("en-GB")}
          </Heading>
          <div className="space-y-2">
            {expandedRequest.notes && (
              <p className="text-sm text-admin-muted italic">{expandedRequest.notes}</p>
            )}
            <div className="grid grid-cols-5 text-xs font-medium text-admin-muted border-b pb-1">
              <span>Image</span>
              <span>Item</span>
              <span>Requested</span>
              <span>Delivered</span>
              <span>Unit</span>
            </div>
            {expandedRequest.items.map((item) => {
              const delivered = Number(item.quantityDelivered)
              const requested = Number(item.quantityRequested)
              const isComplete = delivered >= requested
              return (
                <div key={item.id} className="grid grid-cols-5 items-center text-sm py-1">
                  {item.stockSupply.image ? (
                    <img
                      src={stockSupplyImageUrl(item.stockSupply.image) ?? ""}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-admin-content flex items-center justify-center">
                      <Package size={14} className="text-admin-header-text/30" />
                    </div>
                  )}
                  <span>{item.stockSupply.name}</span>
                  <span>{requested}</span>
                  <span className={isComplete ? "text-green-600" : "text-orange-600"}>
                    {delivered}
                  </span>
                  <span className="text-admin-muted">{item.stockSupply.unit}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function KitchenInventoryView({ userId }: { userId: string }) {
  const [items, setItems] = useState<KitchenConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cookDialog, setCookDialog] = useState<{ open: boolean; item: KitchenConfigItem | null }>({
    open: false,
    item: null,
  })
  const [cookQty, setCookQty] = useState(1)
  const [cookNotes, setCookNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  async function loadInventory() {
    try {
      setLoading(true)
      const data = await getKitchenConfig()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load kitchen inventory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  function openCookDialog(item: KitchenConfigItem) {
    setCookDialog({ open: true, item })
    setCookQty(1)
    setCookNotes("")
    setSubmitSuccess(false)
  }

  async function handleCookSubmit() {
    if (!cookDialog.item || cookQty <= 0) return

    try {
      setSubmitting(true)
      setError("")
      await createCookingRecord({
        stockSupplyId: cookDialog.item.id,
        quantityCooked: cookQty,
        cookedById: userId,
        notes: cookNotes || undefined,
      })
      setSubmitSuccess(true)
      setTimeout(() => {
        setCookDialog({ open: false, item: null })
        loadInventory()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record cooking")
    } finally {
      setSubmitting(false)
    }
  }

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(items)

  const columns: Column[] = [
    { label: "Item", key: "name" },
    { label: "Plates/Unit", key: "platesPerUnit" },
    { label: "Unit", key: "unit" },
          { label: "Action", key: "action", isAction: true, align: "center" },
  ]

  function renderCell(item: KitchenConfigItem, column: Column) {
    switch (column.key) {
      case "name":
        return <span className="font-medium">{item.name}</span>
      case "platesPerUnit":
        return <span className="text-admin-muted">{item.platesPerUnit ?? "—"}</span>
      case "unit":
        return <span className="text-admin-muted">{item.unit}</span>
      case "action":
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => openCookDialog(item)}
            disabled={!item.platesPerUnit}
          >
            <ChefHat size={14} className="mr-1" />
            Cook...
          </Button>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading kitchen inventory...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Kitchen Stock</Heading>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No kitchen items configured. Set up plates per unit in Settings."
        pagination={{
          currentPage,
          totalPages,
          onPrev: prevPage,
          onNext: nextPage,
          canPrev,
          canNext,
        }}
      />

      <Dialog
        open={cookDialog.open}
        onOpenChange={(open) => setCookDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cook: {cookDialog.item?.name}</DialogTitle>
            <DialogDescription>
              Record cooking activity for this item
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <div className="py-4 text-center text-green-600 font-medium">
              Cooking recorded successfully!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-admin-muted">
                Plates per unit: {cookDialog.item?.platesPerUnit}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookQty">Quantity to cook</Label>
                <Input
                  id="cookQty"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={cookQty}
                  onChange={(e) => setCookQty(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-admin-muted">
                  Unit: {cookDialog.item?.unit} | Expected plates: {cookQty * (cookDialog.item?.platesPerUnit ?? 0)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookNotes">Notes (optional)</Label>
                <Textarea
                  id="cookNotes"
                  placeholder="e.g., Batch for lunch service"
                  value={cookNotes}
                  onChange={(e) => setCookNotes(e.target.value)}
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
                <Button onClick={handleCookSubmit} disabled={submitting || cookQty <= 0}>
                  {submitting ? "Recording..." : "Record Cooking"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CookingHistoryView({ userId }: { userId: string }) {
  const [records, setRecords] = useState<CookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadRecords() {
    try {
      setLoading(true)
      const data = await getCookingRecords()
      setRecords(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooking records")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [userId])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(records)

  const columns: Column[] = [
    { label: "Date/Time", key: "createdAt" },
    { label: "Item", key: "name" },
    { label: "Cooked", key: "cooked" },
    { label: "Plates", key: "plates" },
  ]

  function renderCell(record: CookingRecord, column: Column) {
    switch (column.key) {
      case "createdAt":
        return (
          <span className="text-admin-muted">
            {new Date(record.createdAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )
      case "name":
        return <span className="font-medium">{record.stockSupply.name}</span>
      case "cooked":
        return <span>{Number(record.quantityCooked)} {record.stockSupply.unit}</span>
      case "plates":
        return <span className="text-admin-muted">{record.platesExpected}</span>
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading cooking history...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text">Cooking History</Heading>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(record) => record.id}
        emptyMessage="No cooking records yet"
        pagination={{
          currentPage,
          totalPages,
          onPrev: prevPage,
          onNext: nextPage,
          canPrev,
          canNext,
        }}
      />
    </div>
  )
}

export default Kitchen
