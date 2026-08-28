import { useState, useEffect, useMemo, useCallback } from "react"
import { Utensils } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getCookedMenus, stockSupplyImageUrl } from "@/lib/api"
import AssignmentModal from "./AssignmentModal"

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getCookedMenus()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cooked foods")
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
        item.stockSupply?.name.toLowerCase().includes(q) ||
        item.menus.some((m) => m.menuName.toLowerCase().includes(q))
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
    { label: "Stock Image", key: "stockImage" },
    { label: "Stock Item", key: "stockItem" },
    { label: "Stock Item Menus", key: "stockItemMenus" },
    { label: "Produced Plates", key: "produced" },
    { label: "Assigned", key: "assigned" },
    { label: "Available", key: "available" },
    { label: "Actions", key: "actions", isAction: true, align: "right" },
  ]

  function renderCell(row: CookedMenuItem, column: Column) {
    switch (column.key) {
      case "stockItem":
        return <span className="font-medium">{row.stockSupply?.name ?? "—"}</span>
      case "stockImage": {
        const url = stockSupplyImageUrl(row.stockSupply?.image ?? null)
        return (
          <div className="flex items-center justify-center">
            {url ? (
              <img src={url} alt={row.stockSupply?.name ?? ""} className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <span className="text-admin-muted text-xs">—</span>
            )}
          </div>
        )
      }
      case "produced":
        return <span>{row.cooking.totalProduced} plates</span>
      case "assigned": {
        const assigned = row.cooking.totalAssigned
        return assigned === 0 ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            {assigned} plates
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            {assigned} plates
          </span>
        )
      }
      case "stockItemMenus": {
        if (!row.menus || row.menus.length === 0) {
          return <span className="text-admin-muted text-xs">—</span>
        }
        return (
          <div className="flex flex-col items-center gap-0.5">
            {row.menus.map((m) => (
              <span
                key={m.menuId}
                className="inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-medium bg-admin-content border border-admin-card-border whitespace-nowrap leading-tight"
              >
                <span className="text-admin-header-text">{m.menuName}</span>
                <span className="rounded-full bg-red-500/15 text-red-600 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-tight">
                  {m.remaining}
                </span>
              </span>
            ))}
          </div>
        )
      }
      case "available": {
        const available = row.cooking.totalProduced - row.cooking.totalAssigned
        return available <= 0 ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            FULLY ASSIGNED
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {available} plates
          </span>
        )
      }
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setEditDialog({ open: true, item: row })}>
              <Utensils size={14} className="mr-1" />
              Assign Plates
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading cooked foods...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center">
        Today&apos;s Cooked Food
      </Heading>

      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(row) => row.id}
        emptyMessage={
          search
            ? "No cooked foods match your search."
            : "No cooked foods. Cook items in Kitchen first."
        }
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
            placeholder="Search cooked foods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        }
      />

      <AssignmentModal
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, item: null })}
        batchId={editDialog.item?.id ?? null}
        title={editDialog.item?.stockSupply?.name ?? ""}
        onRefresh={loadData}
      />
    </div>
  )
}
