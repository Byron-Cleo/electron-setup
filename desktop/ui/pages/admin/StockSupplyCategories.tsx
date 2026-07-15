import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
import { getStockSupplyCategories, deleteStockSupplyCategory } from "@/lib/api"

export default function StockSupplyCategories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<StockSupplyCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<StockSupplyCategory | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const data = await getStockSupplyCategories()
      setCategories(data)
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
      await deleteStockSupplyCategory(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAll()
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-admin-header-text mb-6">Restaurant Stock Supply Categories</h1>

      <div className="flex items-center justify-between mb-4">
        <Button onClick={() => navigate("/admin/manager")} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={() => navigate("/admin/manager/stock-supply-categories/new")} className="px-6 py-6 bg-red-500 hover:bg-red-500/90">
          <Plus className="h-4 w-4 mr-2" />
          Add New Category
        </Button>
      </div>

      <Card className="bg-admin-card border-admin-card-border">
        <div className="p-4 border-b border-admin-card-border">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-admin-header-text/60 border-b border-admin-card-border">
                <th className="px-4 py-3 w-[100px]">#</th>
                <th className="px-4 py-3 w-[100px]">Name</th>
                <th className="px-4 py-3 w-[100px]">Description</th>
                <th className="px-4 py-3 w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-admin-header-text/60">
                    No categories found
                  </td>
                </tr>
              ) : (
                filtered.map((cat, i) => (
                  <tr
                    key={cat.id}
                    className="border-b border-admin-card-border last:border-0 hover:bg-admin-content/50"
                  >
                    <td className="px-4 py-3 text-admin-header-text/60">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-admin-header-text">{cat.name}</td>
                    <td className="px-4 py-3 text-admin-header-text/60">{cat.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/manager/stock-supply-categories/${cat.id}`)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(cat)
                            setDeleteError("")
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="min-h-[250px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center !text-red-500">Delete Supply Category!!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">
            Are you sure you want to delete <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded">&quot;{deleteTarget?.name}&quot;</span>? This action cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-500 text-center">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
