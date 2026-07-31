import { useState, useEffect, useMemo, useCallback } from "react"
import { Package, Send, Clock, ChefHat, History, Eye, Flame, Pencil } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import BackButton from "@/components/shared/BackButton"
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
  getDepartments,
  updateCookingRecord,
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
  const [pendingCount, setPendingCount] = useState(0)

  async function loadCounts() {
    try {
      const [pending] = await Promise.all([
        getStockRequests("PENDING"),
      ])
      setPendingCount(pending.length)
    } catch (err) {
      console.error("Failed to load kitchen counts:", err)
    }
  }

  useEffect(() => {
    loadCounts()
  }, [])

  function handleBackToDashboard() {
    setView("dashboard")
    loadCounts()
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-3xl text-admin-header-text">Kitchen</Heading>

      {view !== "dashboard" && (
        <div className="flex items-center justify-between mb-4">
          <BackButton onClick={handleBackToDashboard} />
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
                <div className="flex items-center gap-2 mt-1">
                  {pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {pendingCount} pending
                    </span>
                  ) : (
                    <span className="text-sm text-admin-muted">Request stock items from store</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("cooked-food")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame size={24} className="text-orange-500" />
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
              title="Kitchen Stock Item Requests"
            />
          )}
        </div>
      )}

      {view === "cooked-food" && (
        <div className="space-y-6">
          <div className="flex gap-1 border-b border-admin-card-border">
            {([
              { key: "inventory", label: "Kitchen Production", icon: Flame },
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
  const [search, setSearch] = useState("")
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
      const departments = await getDepartments()
      const kitchenDept = departments.find(
        (d) => d.name.toLowerCase() === "kitchen"
      )
      const [stockData, requestData] = await Promise.all([
        getStockSupplies(kitchenDept?.id),
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

  const activeRequestStockIds = useMemo(() => {
    const ids = new Set<string>()
    for (const req of requests) {
      if (req.status === "PENDING" || req.status === "PARTIAL") {
        for (const item of req.items) {
          ids.add(item.stockSupplyId)
        }
      }
    }
    return ids
  }, [requests])

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

  const filteredItems = useMemo(() => {
    if (!search) return items
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [items, search])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filteredItems)

  const columns: Column[] = [
    { label: "Details", key: "details" },
    { label: "Image", key: "image", align: "center" },
    { label: "Name", key: "name" },
    { label: "Stock", key: "stock" },
    { label: "Stock Status", key: "stockStatus" },
    { label: "Last Request", key: "lastRequest" },
    { label: "Last Request Status", key: "requestStatus" },
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
          <span className="font-medium text-green-600">
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
        if (computeStockStatus(item) === "Not Available") return null
        if (activeRequestStockIds.has(item.id)) return null
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
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Available Stock Items in Store</Heading>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No stock items found"
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
                  className={requestQty > (requestDialog.item?.currentStock ?? 0) ? "border-red-500" : ""}
                />
                {requestQty > (requestDialog.item?.currentStock ?? 0) && (
                  <p className="text-xs text-red-500">
                    Cannot request more than available stock ({requestDialog.item?.currentStock} {requestDialog.item?.unit})
                  </p>
                )}
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
                <Button onClick={handleRequestSubmit} disabled={submitting || requestQty <= 0 || requestQty > (requestDialog.item?.currentStock ?? 0)}>
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
  const [search, setSearch] = useState("")

  const [editDialog, setEditDialog] = useState<{ open: boolean; item: KitchenStockItem | null }>({
    open: false,
    item: null,
  })
  const [editRecord, setEditRecord] = useState<CookingRecord | null>(null)
  const [editQty, setEditQty] = useState(0)
  const [editPlatesActual, setEditPlatesActual] = useState<number | "">("")
  const [editNotes, setEditNotes] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editSuccess, setEditSuccess] = useState(false)
  const [editError, setEditError] = useState("")
  const [editLoadingRecord, setEditLoadingRecord] = useState(false)

  async function openEditDialog(item: KitchenStockItem) {
    setEditDialog({ open: true, item })
    setEditSuccess(false)
    setEditError("")
    setEditRecord(null)
    setEditLoadingRecord(true)
    try {
      const records = await getCookingRecords(item.id)
      const latest = records.length > 0 ? records[0] : null
      setEditRecord(latest)
      setEditQty(latest?.quantityCooked ?? 0)
      setEditPlatesActual(latest?.platesActual ?? "")
      setEditNotes(latest?.notes ?? "")
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to load cooking record")
    } finally {
      setEditLoadingRecord(false)
    }
  }

  async function handleEditSubmit() {
    if (!editRecord) return
    try {
      setEditSubmitting(true)
      setEditError("")
      await updateCookingRecord(editRecord.id, {
        quantityCooked: editQty > 0 ? editQty : undefined,
        platesActual: editPlatesActual !== "" ? Number(editPlatesActual) : undefined,
        notes: editNotes || undefined,
      })
      setEditSuccess(true)
      setTimeout(() => {
        setEditDialog({ open: false, item: null })
        setEditRecord(null)
        loadInventory()
      }, 1500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update cooking record")
    } finally {
      setEditSubmitting(false)
    }
  }

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
    const maxQty = cookDialog.item.rawStockPending
    if (cookQty > maxQty) {
      setError(`Cannot cook more than the delivered amount. Max: ${maxQty} ${cookDialog.item.unit}`)
      return
    }

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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aHas = a.rawStockPending > 0 ? 1 : 0
      const bHas = b.rawStockPending > 0 ? 1 : 0
      if (aHas !== bHas) return bHas - aHas
      const aDate = a.lastCookedDate ? new Date(a.lastCookedDate).getTime() : 0
      const bDate = b.lastCookedDate ? new Date(b.lastCookedDate).getTime() : 0
      return bDate - aDate
    })
  }, [items])

  const filteredItems = useMemo(() => {
    if (!search) return sortedItems
    return sortedItems.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [sortedItems, search])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filteredItems)

  const columns: Column[] = [
    { label: "Item", key: "name" },
    { label: "Delivered Amnt", key: "ordered" },
    { label: "Cooked", key: "cooked" },
    { label: "Plates/Unit", key: "platesPerUnit" },
    { label: "Plates Made", key: "platesMade" },
    { label: "Cooked Date", key: "lastCooked" },
    { label: "Remaining", key: "remaining" },
    { label: "Action", key: "action", isAction: true, align: "center" },
  ]

  function renderCell(item: KitchenStockItem, column: Column) {
    switch (column.key) {
      case "name":
        return <span className="font-medium">{item.name}</span>
      case "lastCooked": {
        const todayStr = new Date().toISOString().split("T")[0]
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]
        const cooked = item.lastCookedDate ? new Date(item.lastCookedDate) : null
        const cookedStr = cooked ? cooked.toISOString().split("T")[0] : null
        const suffix = cookedStr === todayStr ? " (Today)" : cookedStr === yesterdayStr ? " (Yestdy)" : ""
        return (
          <span className="text-foreground text-xs font-medium whitespace-nowrap">
            {cooked
              ? cooked.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) + suffix + " " + cooked.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        )
      }
      case "platesPerUnit":
        return <span className="text-admin-muted">{item.platesPerUnit ?? "—"}</span>
      case "ordered":
        return <span>{formatQuantityWithUnit(item.totalOrdered, item.unit)}</span>
      case "cooked":
        return <span>{formatQuantityWithUnit(item.totalCooked, item.unit)}</span>
      case "remaining":
        return (
          <span className={item.rawStockPending > 0 ? "text-amber-600 font-medium" : "text-admin-muted"}>
            {formatQuantityWithUnit(item.rawStockPending, item.unit)}
          </span>
        )
      case "platesMade": {
        const expected = item.platesPerUnit ? item.totalCooked * item.platesPerUnit : null
        const badgeClass = item.totalPlatesProduced === 0
          ? "bg-red-100 text-red-700"
          : expected !== null
            ? item.totalPlatesProduced >= expected
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
            : "bg-admin-bg text-admin-muted"
        return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{item.totalPlatesProduced} Plates</span>
      }
      case "action":
        return (
          <div className="flex items-center justify-center gap-1.5">
            {item.rawStockPending > 0 && (
              <Button
                size="xs"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => openCookDialog(item)}
              >
                <ChefHat />
                Cook More
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={() => openEditDialog(item)}
            >
              <Pencil />
              Edit
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading kitchen inventory...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Cooked Food — Kitchen Production</Heading>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No kitchen items configured. Set up plates per unit in Settings."
        rowClassName={(item) => item.rawStockPending <= 0 ? "opacity-40" : ""}
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
                  onChange={(e) => {
                    const entered = parseFloat(e.target.value) || 0
                    const max = cookDialog.item?.rawStockPending ?? 0
                    setCookQty(Math.min(entered, max))
                  }}
                  className={cookQty > (cookDialog.item?.rawStockPending ?? 0) ? "border-red-500" : ""}
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
                </Button>              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {editDialog.item?.name}</DialogTitle>
            <DialogDescription>
              Update cooking record for this item
            </DialogDescription>
          </DialogHeader>

          {editLoadingRecord ? (
            <div className="py-8 text-center text-admin-muted">
              Loading cooking record...
            </div>
          ) : editSuccess ? (
            <div className="py-4 text-center text-green-600 font-medium">
              Cooking record updated successfully!
            </div>
          ) : !editRecord ? (
            <div className="py-8 text-center text-amber-600 font-medium">
              No cooking record found for this item. Cook some stock first.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>Stock Ordered: <span className="font-medium">{editDialog.item?.totalOrdered} {editDialog.item?.unit}</span></div>
                <div>Already Cooked: <span className="font-medium">{editDialog.item?.totalCooked} {editDialog.item?.unit}</span></div>
                <div className="text-amber-600 font-medium">Remaining (PENDING): {editDialog.item?.rawStockPending} {editDialog.item?.unit}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editQty">Quantity to Cook</Label>
                <Input
                  id="editQty"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={editQty}
                  onChange={(e) => setEditQty(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>Configured Rate: <span className="font-medium">{editDialog.item?.platesPerUnit} plates per {editDialog.item?.unit?.toLowerCase()}</span></div>
                <div>Expected Plates: <span className="font-medium">{editQty * Number(editDialog.item?.platesPerUnit ?? 0)} (= {editQty} × {editDialog.item?.platesPerUnit})</span></div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPlatesActual">Actual Plates Produced</Label>
                <Input
                  id="editPlatesActual"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={`Expected: ${editQty * Number(editDialog.item?.platesPerUnit ?? 0)}`}
                  value={editPlatesActual}
                  onChange={(e) => setEditPlatesActual(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-admin-muted">
                  Kitchen inputs what was actually produced (may differ from expected)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes (optional)</Label>
                <Textarea
                  id="editNotes"
                  placeholder="e.g., Batch for lunch service"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {editError && (
                <p className="text-sm text-red-500">{editError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {!editLoadingRecord && !editSuccess && editRecord && (
              <>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleEditSubmit} disabled={editSubmitting}>
                  {editSubmitting ? "Saving..." : "Save Changes"}
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
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true)
      const [data, reqData] = await Promise.all([
        getCookingRecords(),
        getStockRequests(),
      ])
      setRecords(data)
      setRequests(reqData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooking records")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecords()
  }, [userId, loadRecords])

  const lastRequestMap = useMemo(() => getLastRequestMap(requests), [requests])

  const filteredRecords = useMemo(() => {
    if (!search) return records
    return records.filter((r) =>
      r.stockSupply.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [records, search])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filteredRecords)

  const columns: Column[] = [
    { label: "Cooked Date", key: "cookedDate" },
    { label: "Item", key: "name" },
    { label: "Last Requested Amnt", key: "lastRequested" },
    { label: "Cooked", key: "cooked" },
    { label: "Expected", key: "expected" },
    { label: "Actual", key: "actual" },
    { label: "Variance", key: "variance" },
    { label: "Notes", key: "notes" },
  ]

  function renderCell(record: CookingRecord, column: Column) {
    switch (column.key) {
      case "cookedDate": {
        const cooked = new Date(record.cookedDate)
        const today = new Date()
        const todayStr = today.toISOString().split("T")[0]
        const cookedStr = cooked.toISOString().split("T")[0]
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]
        const suffix = cookedStr === todayStr ? " (Today)" : cookedStr === yesterdayStr ? " (Yestdy)" : ""
        return (
          <span className="text-foreground text-xs font-medium whitespace-nowrap">
            {cooked.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {suffix}
            {" "}
            {new Date(record.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )
      }
      case "name":
        return <span className="font-medium">{record.stockSupply.name}</span>
      case "lastRequested": {
        const lastItem = lastRequestMap.get(record.stockSupplyId)
        return <span>{lastItem ? formatQuantityWithUnit(lastItem.quantityRequested, record.stockSupply.unit) : "—"}</span>
      }
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
            {variance < 0 && <span className="ml-1 text-xs">(under-produced)</span>}
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
      <Heading as="h2" className="text-admin-header-text text-center text-xl">Cooking History</Heading>
      <p className="text-sm text-admin-muted">Variance = Actual − Expected (negative = under-produced)</p>
      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(record) => record.id}
        rowClassName={(record) => {
          const actual = record.platesActual ?? record.platesExpected
          const v = Number(actual) - Number(record.platesExpected)
          return v >= 0 ? "bg-green-100/80" : "bg-red-100/80"
        }}
        emptyMessage="No cooking records for this date"
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
    </div>
  )
}

export default Kitchen
