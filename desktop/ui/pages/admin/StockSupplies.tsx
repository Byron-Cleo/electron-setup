import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus, Pencil, Trash2, ArrowLeft, Package } from "lucide-react"
import {
  getStockSupplies,
  getStockSupplyCategories,
  deleteStockSupply,
  formatSupplyDescription,
  stockSupplyImageUrl,
} from "@/lib/api"
import StockSupplyEditDialog from "@/components/admin/StockSupplyEditDialog"

export default function StockSupplies() {
  const navigate = useNavigate()
  const [supplies, setSupplies] = useState<StockSupply[]>([])
  const [categories, setCategories] = useState<StockSupplyCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<StockSupply | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<StockSupply | null>(null)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const [supplyData, categoryData] = await Promise.all([
        getStockSupplies(),
        getStockSupplyCategories(),
      ])
      setSupplies(supplyData)
      setCategories(categoryData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteStockSupply(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = supplies.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || s.categoryId === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">Stock Supplies</Heading>

      <div className="flex items-center justify-between mb-4">
        <Button onClick={() => navigate("/admin/store")} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={() => navigate("/admin/store/stock-supplies/new")} className="px-6 py-6 bg-red-500 hover:bg-red-500/90">
          <Plus className="h-4 w-4 mr-2" />
          Add New Supply
        </Button>
      </div>

      <Card className="bg-admin-card border-admin-card-border">
        <div className="p-4 border-b border-admin-card-border flex gap-4">
          <Input
            placeholder="Search supplies..."
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

        {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-admin-header-text/60 border-b border-admin-card-border">
                <th className="px-4 py-3 w-[60px]">#</th>
                <th className="px-4 py-3 w-[60px]"></th>
                <th className="px-4 py-3 flex-1">Description</th>
                <th className="px-4 py-3 w-[140px]">Category</th>
                <th className="px-4 py-3 w-[100px]">Reorder</th>
                <th className="px-4 py-3 w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-admin-header-text/60">
                    No supplies found
                  </td>
                </tr>
              ) : (
                filtered.map((supply, i) => {
                  const stock = Number(supply.currentStock)
                  const reorder = Number(supply.reorderLevel ?? 0)
                  const isLow = stock <= reorder
                  return (
                    <tr
                      key={supply.id}
                      className={`border-b border-admin-card-border last:border-0 hover:bg-admin-content/50 ${isLow ? "bg-red-500/5" : ""}`}
                    >
                      <td className="px-4 py-3 text-admin-header-text/60">{i + 1}</td>
                      <td className="px-4 py-3">
                        {supply.image ? (
                          <img
                            src={stockSupplyImageUrl(supply.image) ?? ""}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-admin-content flex items-center justify-center">
                            <Package size={16} className="text-admin-header-text/30" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-admin-header-text">
                        {formatSupplyDescription(supply)}
                        {isLow && (
                          <span className="ml-2 text-xs text-red-500 font-normal">Low Stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-admin-header-text/60">{supply.category.name}</td>
                      <td className="px-4 py-3 text-admin-header-text/60">{reorder ? reorder.toFixed(2) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditTarget(supply)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget(supply)
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
                })
              )}
            </tbody>
          </table>
        )}
      </Card>

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
        onSaved={fetchAll}
      />
    </div>
  )
}
