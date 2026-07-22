import { useState, useEffect, useMemo, useCallback } from "react"
import { Package, Send, Clock, ArrowLeft, UtensilsCrossed, ChefHat, History, Eye } from "lucide-react"
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
  getKitchenInventoryList,
  getCookingRecords,
  createCookingRecord,
  stockSupplyImageUrl,
  formatQuantityWithUnit,
} from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import StockSupplyDetailDialog from "@/components/admin/StockSupplyDetailDialog"
import { RequestStockDesign } from "@/components/shared/RequestStockDesign"

type KitchenView = "dashboard" | "request-food" | "cooked-food"
type RequestTab = "stock" | "history"
type CookedTab = "inventory" | "cooking-history"



type StockDisplayStatus = "Available" | "Restock" | "Not Available"
type RequestDisplayStatus = "Pending" | "Partial" | "Completed"

function computeStockStatus(stock: StockSupply): StockDisplayStatus {
  const current = Number(stock.currentStock)
  if (current <= 0) return "Not Available"
  if (stock.reorderLevel != null && current <= Number(stock.reorderLevel)) return "Restock"
  return "Available"
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
                <Heading as="h3" className="text-lg text-admin-header-text">Kitchen Production/Cooked Food</Heading>
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
          {activeTab === "history" && (
            <RequestStockDesign
              department="kitchen"
              showDepartmentColumn={false}
              showActionColumn={false}
            />
          )}
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
    { label: "Image", key: "image", align: "center" },
    { label: "Name", key: "name" },
    { label: "Stock", key: "stock" },
    { label: "Stock Status", key: "stockStatus" },
    { label: "Last Request", key: "lastRequest" },
    { label: "Request Status", key: "requestStatus" },
    { label: "Actions", key: "actions", isAction: true },
  ]

  function renderCell(item: StockSupply, column: Column) {
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
          <img src={stockSupplyImageUrl(item.image) ?? ""} alt="" className="h-10 w-10 rounded object-cover mx-auto" />
        ) : (
          <div className="h-10 w-10 rounded bg-admin-content flex items-center justify-center mx-auto">
            <Package size={16} className="text-admin-header-text/30" />
          </div>
        )
      case "name":
        return <span className="font-medium">{item.name}</span>
      case "stock":
        return (
          <span className="font-medium">
            {formatQuantityWithUnit(item.currentStock, item.unit)}
          </span>
        )
      case "stockStatus": {
        const stockStatus = computeStockStatus(item)
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            stockStatus === "Available"
              ? "bg-green-100 text-green-700"
              : stockStatus === "Restock"
              ? "bg-red-100 text-red-700"
              : "bg-red-100 text-red-700"
          }`}>
            {stockStatus}
          </span>
        )
      }
      case "lastRequest": {
        const lastItem = lastRequestMap.get(item.id)
        const lastReq = lastItem
          ? requests.find(r => r.id === lastItem.stockRequestId)
          : undefined
        const reqStatus = computeRequestStatus(lastReq)
        if (!reqStatus || !lastItem) {
          return <span className="text-admin-muted">—</span>
        }
        return (
          <span className="text-sm">{formatQuantityWithUnit(lastItem.quantityRequested, item.unit)}</span>
        )
      }
      case "requestStatus": {
        const lastItem = lastRequestMap.get(item.id)
        const lastReq = lastItem
          ? requests.find(r => r.id === lastItem.stockRequestId)
          : undefined
        const reqStatus = computeRequestStatus(lastReq)
        if (!reqStatus) {
          return <span className="text-admin-muted">—</span>
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            reqStatus === "Pending"
              ? "bg-status-pending-bg text-status-pending-text"
              : reqStatus === "Partial"
              ? "bg-status-partial-bg text-status-partial-text"
              : "bg-status-completed-bg text-status-completed-text"
          }`}>
            {reqStatus}
          </span>
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

function KitchenInventoryView({ userId }: { userId: string }) {
  const [items, setItems] = useState<KitchenStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cookDialog, setCookDialog] = useState<{ open: boolean; item: KitchenStockItem | null }>({
    open: false,
    item: null,
  })
  const [cookQty, setCookQty] = useState(1)
  const [cookPlatesActual, setCookPlatesActual] = useState<number | "">("")
  const [cookNotes, setCookNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  async function loadInventory() {
    try {
      setLoading(true)
      const data = await getKitchenInventoryList()
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

  function openCookDialog(item: KitchenStockItem) {
    setCookDialog({ open: true, item })
    setCookQty(1)
    setCookPlatesActual("")
    setCookNotes("")
    setSubmitSuccess(false)
  }

  const expectedPlates = cookDialog.item
    ? cookQty * Number(cookDialog.item.platesPerUnit ?? 0)
    : 0

  async function handleCookSubmit() {
    if (!cookDialog.item || cookQty <= 0) return

    try {
      setSubmitting(true)
      setError("")
      await createCookingRecord({
        stockSupplyId: cookDialog.item.id,
        quantityCooked: cookQty,
        platesActual: cookPlatesActual !== "" ? Number(cookPlatesActual) : undefined,
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
    { label: "Ordered", key: "ordered" },
    { label: "Cooked", key: "cooked" },
    { label: "Remaining", key: "remaining" },
    { label: "Plates Made", key: "platesMade" },
    { label: "Action", key: "action", isAction: true, align: "center" },
  ]

  function renderCell(item: KitchenStockItem, column: Column) {
    switch (column.key) {
      case "name":
        return <span className="font-medium">{item.name}</span>
      case "platesPerUnit":
        return <span className="text-admin-muted">{item.platesPerUnit ?? "—"}</span>
      case "ordered":
        return <span>{item.totalOrdered}</span>
      case "cooked":
        return <span>{item.totalCooked}</span>
      case "remaining":
        return (
          <span className={item.rawStockPending > 0 ? "text-amber-600 font-medium" : "text-admin-muted"}>
            {item.rawStockPending > 0 ? `${item.rawStockPending} PENDING` : "0"}
          </span>
        )
      case "platesMade":
        return <span>{item.totalPlatesProduced}</span>
      case "action":
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => openCookDialog(item)}
          >
            <ChefHat size={14} className="mr-1" />
            Cook More
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
      <Heading as="h2" className="text-admin-header-text">Today's Cooked Food — Kitchen Production</Heading>
      <p className="text-sm text-admin-muted">
        PENDING = Ordered but not yet cooked (carries to tomorrow)
      </p>
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
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>Stock Ordered: <span className="font-medium">{cookDialog.item?.totalOrdered} {cookDialog.item?.unit}</span></div>
                <div>Already Cooked: <span className="font-medium">{cookDialog.item?.totalCooked} {cookDialog.item?.unit}</span></div>
                <div className="text-amber-600 font-medium">Remaining (PENDING): {cookDialog.item?.rawStockPending} {cookDialog.item?.unit}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cookQty">Quantity to Cook</Label>
                <Input
                  id="cookQty"
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={cookDialog.item?.rawStockPending ?? 0}
                  value={cookQty}
                  onChange={(e) => setCookQty(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-admin-muted">
                  Max: {cookDialog.item?.rawStockPending} {cookDialog.item?.unit}
                </p>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>Configured Rate: <span className="font-medium">{cookDialog.item?.platesPerUnit} plates per {cookDialog.item?.unit?.toLowerCase()}</span></div>
                <div>Expected Plates: <span className="font-medium">{expectedPlates} (= {cookQty} × {cookDialog.item?.platesPerUnit})</span></div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cookPlatesActual">Actual Plates Produced</Label>
                <Input
                  id="cookPlatesActual"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={`Expected: ${expectedPlates}`}
                  value={cookPlatesActual}
                  onChange={(e) => setCookPlatesActual(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-admin-muted">
                  Kitchen inputs what was actually produced (may differ from expected)
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
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split("T")[0]
  })

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getCookingRecords(selectedDate)
      setRecords(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooking records")
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadRecords()
  }, [userId, loadRecords])

  function formatDateOption(daysOffset: number): { label: string; value: string } {
    const d = new Date()
    d.setDate(d.getDate() + daysOffset)
    return {
      label: daysOffset === 0 ? "Today" : daysOffset === -1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      value: d.toISOString().split("T")[0],
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
  } = usePagination(records)

  const columns: Column[] = [
    { label: "Time", key: "createdAt" },
    { label: "Item", key: "name" },
    { label: "Cooked", key: "cooked" },
    { label: "Expected", key: "expected" },
    { label: "Actual", key: "actual" },
    { label: "Variance", key: "variance" },
    { label: "Notes", key: "notes" },
  ]

  function renderCell(record: CookingRecord, column: Column) {
    switch (column.key) {
      case "createdAt":
        return (
          <span className="text-admin-muted">
            {new Date(record.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )
      case "name":
        return <span className="font-medium">{record.stockSupply.name}</span>
      case "cooked":
        return <span>{Number(record.quantityCooked)} {record.stockSupply.unit}</span>
      case "expected":
        return <span>{record.platesExpected}</span>
      case "actual":
        return <span>{record.platesActual ?? "—"}</span>
      case "variance": {
        const actual = record.platesActual
        if (actual === null || actual === undefined) return <span className="text-admin-muted">—</span>
        const variance = Number(actual) - Number(record.platesExpected)
        return (
          <span className={`font-medium ${
            variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-admin-muted"
          }`}>
            {variance > 0 ? `+${variance}` : variance}
          </span>
        )
      }
      case "notes":
        return <span className="text-admin-muted text-xs">{record.notes || "—"}</span>
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading cooking history...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Heading as="h2" className="text-admin-header-text">Cooking History</Heading>
        <div className="flex items-center gap-2">
          <Label htmlFor="historyDate" className="text-sm">Date:</Label>
          <select
            id="historyDate"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-input bg-background rounded-md px-3 py-1.5 text-sm"
          >
            <option value={formatDateOption(0).value}>{formatDateOption(0).label}</option>
            <option value={formatDateOption(-1).value}>{formatDateOption(-1).label}</option>
            <option value={formatDateOption(-2).value}>{formatDateOption(-2).label}</option>
            <option value={formatDateOption(-3).value}>{formatDateOption(-3).label}</option>
            <option value={formatDateOption(-4).value}>{formatDateOption(-4).label}</option>
            <option value={formatDateOption(-5).value}>{formatDateOption(-5).label}</option>
            <option value={formatDateOption(-6).value}>{formatDateOption(-6).label}</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-admin-muted">Variance = Actual − Expected (negative = under-produced)</p>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(record) => record.id}
        emptyMessage="No cooking records for this date"
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
