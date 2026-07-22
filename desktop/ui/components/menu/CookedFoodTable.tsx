import { useState, useEffect, useMemo, useCallback } from "react"
import { Pencil, Trash2, Search } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getCookedMenus, updateMenuAvailability } from "@/lib/api"
import EditMenuDialog from "./EditMenuDialog"

interface Props {
  onRefresh?: () => void
}

export default function CookedFoodTable({ onRefresh }: Props) {
  const [items, setItems] = useState<CookedMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: CookedMenuItem | null }>({
    open: false,
    item: null,
  })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: CookedMenuItem | null }>({
    open: false,
    item: null,
  })
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getCookedMenus()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooked menus")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    onRefresh?.()
  }, [items, onRefresh])

  const filteredItems = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.stockSupply?.name.toLowerCase().includes(q)
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

  async function handleDelete() {
    if (!deleteDialog.item) return
    try {
      setDeleting(true)
      await updateMenuAvailability(deleteDialog.item.id, false)
      setItems((prev) => prev.filter((i) => i.id !== deleteDialog.item!.id))
      setDeleteDialog({ open: false, item: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hide menu")
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column[] = [
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Stock Item", key: "stockItem" },
    { label: "Produced", key: "produced" },
    { label: "Assigned", key: "assigned" },
    { label: "Available", key: "available" },
    { label: "Actions", key: "actions", isAction: true, align: "right" },
  ]

  function renderCell(row: CookedMenuItem, column: Column) {
    switch (column.key) {
      case "name":
        return <span className="font-medium">{row.name}</span>
      case "category":
        return <span>{row.category}</span>
      case "stockItem":
        return <span>{row.stockSupply?.name ?? "—"}</span>
      case "produced":
        return <span>{row.cooking.totalProduced}</span>
      case "assigned":
        return <span>{row.cooking.totalAssigned}</span>
      case "available":
        return row.cooking.totalAvailable <= 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            SOLD OUT
          </span>
        ) : (
          <span className="font-medium text-green-600">{row.cooking.totalAvailable}</span>
        )
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditDialog({ open: true, item: row })}
            >
              <Pencil size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setDeleteDialog({ open: true, item: row })}
            >
              <Trash2 size={14} className="mr-1" />
              Hide
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading cooked menus...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Heading as="h2" className="text-admin-header-text">
          Today&apos;s Cooked Food — Menu Variants
        </Heading>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
          <Input
            placeholder="Search by name, category, stock..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(row) => row.id}
        emptyMessage={
          search
            ? "No menu items match your search."
            : "No cooked menu items. Cook items in Kitchen first."
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

      <EditMenuDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, item: null })}
        item={editDialog.item}
        onSaved={loadData}
      />

      {deleteDialog.open && deleteDialog.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-popover rounded-xl p-6 shadow-lg ring-1 ring-foreground/10 w-full max-w-sm space-y-4">
            <Heading as="h3" className="text-admin-header-text">
              Hide Menu Item
            </Heading>
            <p className="text-sm text-admin-muted">
              Are you sure you want to hide &quot;{deleteDialog.item.name}&quot; from the waiter
              screen?
            </p>
            <p className="text-sm text-admin-muted">You can restore it later from this table.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialog({ open: false, item: null })}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Hiding..." : "Hide"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
