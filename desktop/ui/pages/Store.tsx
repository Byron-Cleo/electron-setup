import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Package, ClipboardList, ArrowLeft, Plus, Pencil, Trash2, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
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
import { getStockSupplies, getStockRequests, getStockSupplyCategories, createStockSupply, deleteStockSupply, getLowStockCount } from "@/lib/api"
import { StockRequestsList } from "@/components/store/StockRequestsList"
import StockSupplyEditDialog from "@/components/admin/StockSupplyEditDialog"

type StoreView = "dashboard" | "requests" | "stock" | "restock"

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
                <ClipboardList size={24} className="text-green-600" />
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
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
                <p className="text-sm text-admin-muted">Order new stock</p>
                <p className="text-xs text-admin-muted mt-1">Track all stock movements and transactions.</p>
                {lowStockCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 mt-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {lowStockCount} low stock items
                  </span>
                )}
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
  const [categories, setCategories] = useState<StockSupplyCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<StockSupply | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<StockSupply | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formCategoryId, setFormCategoryId] = useState("")
  const [formUnit, setFormUnit] = useState("")
  const [formCurrentStock, setFormCurrentStock] = useState("")
  const [formReorderLevel, setFormReorderLevel] = useState("")

  function resetForm() {
    setFormName("")
    setFormDescription("")
    setFormCategoryId("")
    setFormUnit("")
    setFormCurrentStock("")
    setFormReorderLevel("")
    setSaveError("")
  }

  async function handleAddItem() {
    if (!formName || !formCategoryId || !formUnit) {
      setSaveError("Name, category, and unit are required")
      return
    }

    try {
      setSaving(true)
      setSaveError("")
      await createStockSupply({
        name: formName,
        description: formDescription || undefined,
        categoryId: formCategoryId,
        unit: formUnit as "KG" | "G" | "L" | "ML" | "PCS",
        currentStock: formCurrentStock ? Number(formCurrentStock) : 0,
        reorderLevel: formReorderLevel ? Number(formReorderLevel) : undefined,
      })
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
      const [supplyData, categoryData] = await Promise.all([
        getStockSupplies(),
        getStockSupplyCategories(),
      ])
      setItems(supplyData)
      setCategories(categoryData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || item.categoryId === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) return <div className="text-admin-muted">Loading stock...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center uppercase">All Current Stock Items</Heading>
      <div className="rounded-lg border border-admin-card-border bg-admin-card overflow-hidden">
        <div className="p-4 border-b border-admin-card-border flex gap-4">
          <Input
            placeholder="Search stock items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-card-border bg-admin-content">
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Name</th>
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Category</th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">Stock</th>
              <th className="text-left px-4 py-3 font-medium text-admin-header-text">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-admin-header-text">Reorder Level</th>
              <th className="px-4 py-3 font-medium text-admin-header-text w-[160px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const isLow =
                item.reorderLevel != null && item.currentStock <= item.reorderLevel
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
                  <td className="px-4 py-3 text-right text-admin-muted">
                    {item.reorderLevel ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(item)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget(item)
                          setDeleteError("")
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-admin-muted">
                  No stock items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showAddModal} onOpenChange={(open) => !open && setShowAddModal(false)}>
        <DialogContent className="min-h-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center">Add Stock Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="Stock item name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Optional description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Unit *</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">Kilogram (KG)</SelectItem>
                    <SelectItem value="G">Gram (G)</SelectItem>
                    <SelectItem value="L">Liter (L)</SelectItem>
                    <SelectItem value="ML">Milliliter (ML)</SelectItem>
                    <SelectItem value="PCS">Pieces (PCS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Current Stock</Label>
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
                <Label className="text-xs">Reorder Level</Label>
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
    </div>
  )
}

function RestockView() {
  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center uppercase">Restock / Procure</Heading>
      <div className="rounded-lg border border-admin-card-border bg-admin-card p-8">
        <p className="text-admin-muted text-center">Restock and procurement features coming soon.</p>
      </div>
    </div>
  )
}

export default Store
