import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Heading } from "@/components/ui/heading"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ArrowLeft, Package, Eye } from "lucide-react"
import {
  getStockSupplies,
  deleteStockSupply,
  formatSupplyDescription,
  formatQuantityWithUnit,
  stockSupplyImageUrl,
} from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import StockSupplyEditDialog from "@/components/admin/StockSupplyEditDialog"
import StockSupplyDetailDialog from "@/components/admin/StockSupplyDetailDialog"

type StockDisplayStatus = "Available" | "Restock" | "Not Available"

function computeStockStatus(stock: StockSupply): StockDisplayStatus {
  const current = Number(stock.currentStock)
  if (current <= 0) return "Not Available"
  if (stock.reorderLevel != null && current <= Number(stock.reorderLevel)) return "Restock"
  return "Available"
}

export default function StockSupplies() {
  const navigate = useNavigate()
  const [supplies, setSupplies] = useState<StockSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<StockSupply | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<StockSupply | null>(null)
  const [detailTarget, setDetailTarget] = useState<StockSupply | null>(null)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const supplyData = await getStockSupplies()
      setSupplies(supplyData)
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
    return s.name.toLowerCase().includes(search.toLowerCase())
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
    { label: "", key: "image" },
    { label: "Description", key: "description" },
    { label: "Stock Status", key: "stockStatus" },
    { label: "Reorder", key: "reorder" },
    { label: "Menu Item", key: "menuItem" },
    { label: "Actions", key: "actions", isAction: true },
  ]

  function renderCell(supply: StockSupply, column: Column) {
    const stock = Number(supply.currentStock)
    const reorder = Number(supply.reorderLevel ?? 0)

    switch (column.key) {
      case "image":
        return supply.image ? (
          <img
            src={stockSupplyImageUrl(supply.image) ?? ""}
            alt=""
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-admin-content flex items-center justify-center">
            <Package size={16} className="text-admin-header-text/30" />
          </div>
        )
      case "description":
        return (
          <span className="font-medium text-admin-header-text">
            {formatSupplyDescription(supply)}
          </span>
        )
      case "stockStatus": {
        const stockStatus = computeStockStatus(supply)
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            stockStatus === "Available"
              ? "bg-green-100 text-green-700"
              : stockStatus === "Restock"
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
          }`}>
            {stockStatus}
          </span>
        )
      }
      case "reorder":
        return (
          <span className="text-admin-header-text/60">
            {reorder ? formatQuantityWithUnit(reorder, supply.unit) : "—"}
          </span>
        )
      case "menuItem":
        return supply.isMenuItem ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-800 text-white">
            Yes
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
            No
          </span>
        )
      case "actions":
        return (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDetailTarget(supply)}>
              <Eye className="h-4 w-4 mr-1" />
              Details
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(supply)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDeleteTarget(supply); setDeleteError("") }}
            >
              <Trash2 className="h-4 w-4 mr-1 text-red-500" />
              Delete
            </Button>
          </div>
        )
      default:
        return null
    }
  }

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

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(s) => s.id}
          emptyMessage="No supplies found"
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
              placeholder="Search supplies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          }
        />
      )}

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

      <StockSupplyDetailDialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        supplyId={detailTarget?.id ?? null}
      />
    </div>
  )
}
