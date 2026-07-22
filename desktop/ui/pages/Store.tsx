import { useState, useEffect } from "react"
import { Package, ShoppingBasket, ArrowLeft, Plus, Pencil, Trash2, RefreshCw, X, Eye, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getStockSupplies, getStockRequests, createStockSupply, deleteStockSupply, getLowStockCount, getLowStockSupplies, stockSupplyImageUrl, formatQuantityWithUnit, getDepartments, getMenus } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { StockRequestsList } from "@/components/store/StockRequestsList"
import StockSupplyEditDialog from "@/components/admin/StockSupplyEditDialog"
import StockSupplyDetailDialog from "@/components/admin/StockSupplyDetailDialog"
import SearchableSelect from "@/components/shared/SearchableSelect"

type StoreView = "dashboard" | "requests" | "stock" | "restock"

type StockDisplayStatus = "Available" | "Restock" | "Not Available"

function computeStockStatus(stock: StockSupply): StockDisplayStatus {
  const current = Number(stock.currentStock)
  if (current <= 0) return "Not Available"
  if (stock.reorderLevel != null && current <= Number(stock.reorderLevel)) return "Restock"
  return "Available"
}

function Store() {
  const [view, setView] = useState<StoreView>("dashboard")
  const [stockCount, setStockCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [partialCount, setPartialCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadCounts()
  }, [])

  async function loadCounts() {
    try {
      const [supplies, pending, partial, lowStock] = await Promise.all([
        getStockSupplies(),
        getStockRequests("PENDING"),
        getStockRequests("PARTIAL"),
        getLowStockCount(),
      ])
      setStockCount(supplies.length)
      setPendingCount(pending.length)
      setPartialCount(partial.length)
      setLowStockCount(lowStock.count)
    } catch (err) {
      console.error("Failed to load store counts:", err)
    }
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-3xl text-admin-header-text">Store / Procurement</Heading>

      {view !== "dashboard" && (
        <div className="flex items-center justify-between mb-4">
          <Button onClick={() => setView("dashboard")} className="px-6 py-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {view === "stock" && (
            <Button onClick={() => setShowAddModal(true)} className="px-6 py-6 bg-red-500 hover:bg-red-500/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Stock Item
            </Button>
          )}
        </div>
      )}

      {view === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("stock")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Package size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">All Current Stock Items</Heading>
                <p className="text-sm text-admin-muted">{stockCount} items</p>
                <p className="text-xs text-admin-muted mt-1">View current stock levels for all items across the store.</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("requests")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ShoppingBasket size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">Inhouse Stock Requests</Heading>
                <div className="flex items-center gap-2 mt-1">
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {pendingCount} pending
                    </span>
                  )}
                  {partialCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-status-partial-bg text-status-partial-text">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-partial-text" />
                      {partialCount} partial
                    </span>
                  )}
                  {pendingCount === 0 && partialCount === 0 && (
                    <span className="text-sm text-admin-muted">No pending requests</span>
                  )}
                </div>
                <p className="text-xs text-admin-muted mt-1">Request and fulfill stock from store to kitchen and departments.</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("restock")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <RefreshCw size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">Restock / Procure Items</Heading>
                <div className="flex items-center gap-2 mt-1">
                  {lowStockCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {lowStockCount} low stock items
                    </span>
                  ) : (
                    <span className="text-sm text-admin-muted">No items to restock</span>
                  )}
                </div>
                <p className="text-xs text-admin-muted mt-1">Track all stock movements and transactions.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {view === "requests" && (
        <StockRequestsList onRequestFulfilled={loadCounts} />
      )}

      {view === "stock" && <StockView showAddModal={showAddModal} setShowAddModal={setShowAddModal} />}

      {view === "restock" && <RestockView />}
    </div>
  )
}

function StockView({ showAddModal, setShowAddModal }: { showAddModal: boolean; setShowAddModal: (v: boolean) => void }) {
  const [items, setItems] = useState<StockSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<StockSupply | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<StockSupply | null>(null)
  const [detailTarget, setDetailTarget] = useState<StockSupply | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formUnit, setFormUnit] = useState("")
  const [formCurrentStock, setFormCurrentStock] = useState("")
  const [formReorderLevel, setFormReorderLevel] = useState("")
  const [formIsMenuStock, setFormIsMenuStock] = useState(false)
  const [formMenuId, setFormMenuId] = useState<string | null>(null)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [formImageFile, setFormImageFile] = useState<File | null>(null)
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set())

  function resetForm() {
    setFormName("")
    setFormDescription("")
    setFormUnit("")
    setFormCurrentStock("")
    setFormReorderLevel("")
    setFormIsMenuStock(false)
    setFormMenuId(null)
    setFormImageFile(null)
    setFormImagePreview(null)
    setSelectedDepts(new Set())
    setSaveError("")
  }

  async function handleAddItem() {
    if (!formName || !formUnit) {
      setSaveError("Name and unit are required")
      return
    }

    if (selectedDepts.size === 0) {
      setSaveError("At least one department must be assigned")
      return
    }

    try {
      setSaving(true)
      setSaveError("")
      await createStockSupply({
        name: formName,
        description: formDescription || undefined,
        unit: formUnit as "KG" | "PKT" | "L" | "ML" | "PCS",
        currentStock: formCurrentStock ? Number(formCurrentStock) : 0,
        reorderLevel: formReorderLevel ? Number(formReorderLevel) : undefined,
        isMenuStock: formIsMenuStock,
        menuId: formMenuId,
        departmentIds: Array.from(selectedDepts),
      }, formImageFile ?? undefined)
      setShowAddModal(false)
      await loadStock()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteStockSupply(deleteTarget.id)
      setDeleteTarget(null)
      await loadStock()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  async function loadStock() {
    try {
      setLoading(true)
      const supplyData = await getStockSupplies()
      setItems(supplyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  useEffect(() => {
    if (showAddModal) {
      getDepartments().then(setDepartments).catch(() => {})
      if (menus.length === 0) {
        getMenus().then(setMenus).catch(() => {})
      }
    }
  }, [showAddModal])

  const filtered = items.filter((item) => {
    return item.name.toLowerCase().includes(search.toLowerCase())
  })

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  const columns: Column[] = [
          { label: "Details", key: "details" },
    { label: "Image", key: "image", align: "center" },
    { label: "Name", key: "name" },
    { label: "Stock", key: "stock" },
    { label: "Stock Status", key: "stockStatus" },
    { label: "Reorder Level", key: "reorderLevel" },
    { label: "Menu Item", key: "menuItem" },
    { label: "Assigned Departments", key: "departments" },
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
        return <span>{item.name}</span>
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
      case "reorderLevel":
        return (
          <span className="text-status-partial-text">
            {item.reorderLevel != null ? formatQuantityWithUnit(item.reorderLevel, item.unit) : "—"}
          </span>
        )
      case "menuItem":
        return item.isMenuStock ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-800 text-white">
            Yes
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
            No
          </span>
        )
      case "departments":
        return item.departments && item.departments.length > 0 ? (
          <div className="flex flex-wrap gap-1 justify-center">
            {item.departments.map((dept) => (
              <span key={dept.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {dept.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-admin-header-text/40 text-xs">—</span>
        )
      case "actions":
        return (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(item)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(item); setDeleteError("") }}>
              <Trash2 className="h-4 w-4 mr-1 text-red-500" />
              Delete
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading stock...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center uppercase">All Current Stock Items</Heading>
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
        header={
          <Input
            placeholder="Search stock items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        }
      />

      <Dialog open={showAddModal} onOpenChange={(open) => !open && setShowAddModal(false)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center">Add Stock Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Name <span className="text-red-500 text-base font-bold">*</span></Label>
              <Input
                placeholder="Stock item name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Stock Item Count <span className="text-red-500 text-base font-bold">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={formCurrentStock}
                  onChange={(e) => setFormCurrentStock(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reorder Level Count <span className="text-red-500 text-base font-bold">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Optional"
                  value={formReorderLevel}
                  onChange={(e) => setFormReorderLevel(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Stock Unit <span className="text-red-500 text-base font-bold">*</span></Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">Kilogram (KG)</SelectItem>
                    <SelectItem value="PKT">Packets (Pkt)</SelectItem>
                    <SelectItem value="L">Liter (L)</SelectItem>
                    <SelectItem value="ML">Milliliter (ML)</SelectItem>
                    <SelectItem value="PCS">Pieces (PCS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 rounded-lg border p-3 mt-6">
                <label className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formIsMenuStock}
                    onChange={(e) => setFormIsMenuStock(e.target.checked)}
                  />
                  <div className="h-5 w-5 rounded border-2 border-admin-card-border peer-checked:bg-brand-green peer-checked:border-brand-green transition-colors flex items-center justify-center">
                    {formIsMenuStock && <Check className="h-3 w-3 text-white" />}
                  </div>
                </label>
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Is Menu Item?</span>
                  <p className="text-xs text-admin-muted">
                    Mark this item as a menu ingredient (used for cooking)
                  </p>
                </div>
              </div>
            </div>

            {formIsMenuStock && (
              <div className="space-y-1">
                <Label className="text-xs">Menu Item</Label>
                <SearchableSelect
                  options={menus.map((m) => ({ value: m.id, label: m.name }))}
                  value={formMenuId}
                  onChange={setFormMenuId}
                  placeholder="Select menu item"
                  searchPlaceholder="Search menus..."
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Image</Label>
              <p className="text-xs text-admin-muted">JPEG, PNG, or WebP. Max 5MB.</p>
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-lg border border-admin-card-border bg-admin-content flex items-center justify-center overflow-hidden shrink-0">
                  {formImagePreview ? (
                    <img src={formImagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={20} className="text-admin-muted/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-admin-card-border cursor-pointer hover:bg-admin-content/50 text-sm text-admin-header-text">
                    Choose Image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          setSaveError("Image must be under 5MB")
                          return
                        }
                        setFormImageFile(file)
                        setFormImagePreview(URL.createObjectURL(file))
                      }}
                    />
                  </label>
                  {formImagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormImageFile(null)
                        setFormImagePreview(null)
                      }}
                      className="text-red-500 hover:text-red-600 h-auto py-1"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {departments.length > 0 && (
              <div>
                <Label className="text-xs">Assigned Departments <span className="text-red-500 text-base font-bold">*</span></Label>
                <p className="text-xs text-admin-muted mb-2">Which departments can order this item?</p>
                <div className="flex flex-wrap gap-3">
                  {departments.map((dept) => {
                    const isSelected = selectedDepts.has(dept.id)
                    return (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-admin-accent/10 border-admin-accent text-admin-header-text"
                            : "border-admin-card-border text-admin-header-text/60 hover:bg-admin-content/50"
                        }`}
                      >
                        <label className="relative cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = new Set(selectedDepts)
                              if (e.target.checked) {
                                next.add(dept.id)
                              } else {
                                next.delete(dept.id)
                              }
                              setSelectedDepts(next)
                            }}
                          />
                          <div className="h-4 w-4 rounded border-2 border-admin-card-border peer-checked:bg-brand-green peer-checked:border-brand-green transition-colors flex items-center justify-center">
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </label>
                        {dept.name}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Optional description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            {saveError && (
              <p className="text-sm text-red-500">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={saving} className="bg-red-500 hover:bg-red-500/90">
              {saving ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="min-h-[250px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center !text-red-500">Deactivate Supply</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">
            Are you sure you want to deactivate <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded">&quot;{deleteTarget?.name}&quot;</span>?
          </p>
          <p className="text-xs text-muted-foreground text-center">
            This supply will be hidden from active inventory but preserved for historical records.
          </p>
          {deleteError && <p className="text-sm text-red-500 text-center">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockSupplyEditDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        supplyId={editTarget?.id ?? null}
        onSaved={loadStock}
      />

      <StockSupplyDetailDialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        supplyId={detailTarget?.id ?? null}
      />
    </div>
  )
}

function RestockView() {
  const [items, setItems] = useState<StockSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [detailTarget, setDetailTarget] = useState<StockSupply | null>(null)
  const [restockTarget, setRestockTarget] = useState<StockSupply | null>(null)
  const [restockQuantity, setRestockQuantity] = useState("")
  const [restockSubmitting, setRestockSubmitting] = useState(false)
  const [restockSuccess, setRestockSuccess] = useState(false)

  async function loadLowStock() {
    try {
      setLoading(true)
      const data = await getLowStockSupplies()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load low stock items")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLowStock()
  }, [])

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  function getRestockQuantity(item: StockSupply): number {
    const stock = Number(item.currentStock)
    const reorder = Number(item.reorderLevel)
    return reorder - stock
  }

  function handleRestockSubmit() {
    if (!restockTarget || !restockQuantity) return
    setRestockSubmitting(true)
    setTimeout(() => {
      setRestockSubmitting(false)
      setRestockTarget(null)
      setRestockQuantity("")
      setRestockSuccess(true)
      setTimeout(() => setRestockSuccess(false), 3000)
    }, 500)
  }

  const columns: Column[] = [
    { label: "Details", key: "details" },
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Stock", key: "stock" },
    { label: "Stock Status", key: "stockStatus" },
    { label: "Restock Quantity", key: "restockQty" },
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
        return <span>{item.name}</span>
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
      case "restockQty": {
        const qty = getRestockQuantity(item)
        return (
          <span className="font-medium text-amber-600">
            {qty > 0 ? formatQuantityWithUnit(qty, item.unit) : "—"}
          </span>
        )
      }
      case "actions":
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRestockTarget(item)
              setRestockQuantity(String(getRestockQuantity(item)))
            }}
            className="bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Restock
          </Button>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading low stock items...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center uppercase">Restock / Procure Items</Heading>

      {restockSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 text-sm">
          Restock quantity submitted successfully. You can view the shopping list from the Store dashboard.
        </div>
      )}

      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No low stock items found"
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
            placeholder="Search low stock items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        }
      />

      <StockSupplyDetailDialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        supplyId={detailTarget?.id ?? null}
      />

      <Dialog open={!!restockTarget} onOpenChange={(open) => !open && setRestockTarget(null)}>
        <DialogContent className="min-h-[300px]">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center">Restock / Procure Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-admin-content p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-admin-muted">Item:</span>
                <span className="font-medium text-admin-header-text">{restockTarget?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-admin-muted">Current Stock:</span>
                <span className="font-medium text-admin-header-text">
                  {restockTarget && formatQuantityWithUnit(restockTarget.currentStock, restockTarget.unit)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-admin-muted">Reorder Level:</span>
                <span className="font-medium text-admin-header-text">
                  {restockTarget && restockTarget.reorderLevel != null
                    ? formatQuantityWithUnit(restockTarget.reorderLevel, restockTarget.unit)
                    : "—"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Restock Quantity *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step="1"
                  placeholder="Enter quantity"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-admin-muted whitespace-nowrap">
                  {restockTarget?.unit}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restockSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRestockSubmit} disabled={restockSubmitting || !restockQuantity} className="bg-green-500 hover:bg-green-600">
              {restockSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Store
