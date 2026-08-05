import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Plus, Pencil, Eye } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getAccompaniments, menuImageUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import AccompanimentDialog from "./AccompanimentDialog"
import AccompanimentDetailDialog from "./AccompanimentDetailDialog"

export default function AccompanimentsTable() {
  const [items, setItems] = useState<Accompaniment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"all" | "STARCH" | "VEGETABLE">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Accompaniment | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<Accompaniment | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getAccompaniments()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accompaniments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredItems = useMemo(() => {
    let result = items
    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category === categoryFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    return result
  }, [items, search, categoryFilter])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filteredItems)

  const counts = useMemo(() => ({
    all: items.length,
    starch: items.filter((i) => i.category === "STARCH").length,
    vegetable: items.filter((i) => i.category === "VEGETABLE").length,
  }), [items])

  const columns: Column[] = [
    { label: "Details", key: "details", isAction: true, className: "text-left" },
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Price", key: "price" },
    { label: "Default", key: "isDefault" },
    { label: "Description", key: "description" },
    { label: "Actions", key: "actions", isAction: true },
  ]

  function renderCell(row: Accompaniment, column: Column) {
    switch (column.key) {
      case "image":
        return (
          <div className="flex items-center justify-center">
            {row.image ? (
              <img src={menuImageUrl(row.image) ?? ""} alt={row.name} className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <span className="text-admin-muted text-xs">—</span>
            )}
          </div>
        )
      case "name":
        return <span className="font-medium">{row.name}</span>
      case "category":
        return (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            row.category === "STARCH" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
          )}>
            {row.category}
          </span>
        )
      case "price":
        return <span>{row.price ? `KSh ${row.price}` : "—"}</span>
      case "isDefault":
        return row.isDefault ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            Default
          </span>
        ) : (
          <span className="text-admin-muted text-xs">—</span>
        )
      case "description":
        return <span className="text-sm text-admin-muted max-w-xs truncate block">{row.description ?? "—"}</span>
      case "details":
        return (
          <div className="flex justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setDetailItem(row)
                setDetailOpen(true)
              }}
              aria-label={`View details for ${row.name}`}
            >
              <Eye size={14} />
              Details
            </Button>
          </div>
        )
      case "actions":
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setEditItem(row)
                setDialogOpen(true)
              }}
              aria-label={`Edit ${row.name}`}
            >
              <Pencil size={14} />
              Edit Acc.
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading accompaniments...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <Heading as="h2" className="text-admin-header-text col-start-2 text-center">Menu Accompaniments</Heading>
        <Button
          onClick={() => {
            setEditItem(null)
            setDialogOpen(true)
          }}
          className="px-6 py-6 col-start-3 justify-self-end"
        >
          <Plus size={16} className="mr-1" />
          Create Menu Accompaniment
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "STARCH", "VEGETABLE"] as const).map((cat) => {
          const isActive = categoryFilter === cat
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "flex flex-col items-center px-4 py-3 h-auto rounded-lg cursor-pointer transition-colors",
                isActive && (cat === "all" ? "bg-admin-accent/60 text-white" : cat === "STARCH" ? "bg-amber-600/60 text-white" : "bg-green-600/60 text-white"),
                !isActive && cat === "all" && "border-4 border-admin-accent/40 text-admin-accent",
                !isActive && cat === "STARCH" && "border-4 border-amber-400 text-amber-700",
                !isActive && cat === "VEGETABLE" && "border-4 border-green-400 text-green-600",
              )}
            >
              <span className="text-sm font-bold leading-tight">{cat === "all" ? "All" : cat}</span>
              <span className={cn(
                "mt-0.5 text-xs font-bold rounded-full px-2 py-0.5",
                isActive && "bg-white/20 text-white",
                !isActive && cat === "all" && "bg-admin-accent/10 text-admin-accent",
                !isActive && cat === "STARCH" && "bg-amber-100 text-amber-700",
                !isActive && cat === "VEGETABLE" && "bg-green-100 text-green-600",
              )}>
                {counts[cat === "all" ? "all" : cat.toLowerCase() as "starch" | "vegetable"]}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(row) => row.id}
        emptyMessage={
          search
            ? "No accompaniments match your search."
            : "No accompaniments found."
        }
        header={
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
            <Input
              placeholder="Search accompaniments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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

      <AccompanimentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditItem(null)
        }}
        editItem={editItem}
        onSaved={loadData}
      />

      <AccompanimentDetailDialog
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetailItem(null)
        }}
        item={detailItem}
      />
    </div>
  )
}
