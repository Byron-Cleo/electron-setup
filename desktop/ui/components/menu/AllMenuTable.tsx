import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Eye, Pencil, EyeOff, Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getMenus, updateMenuAvailability, menuImageUrl } from "@/lib/api"
import { cn } from "@/lib/utils"
import { MEAL_PERIODS, type MealPeriodLabel } from "@/lib/mealPeriod"
import CreateMenuDialog from "./CreateMenuDialog"
import MenuDetailDialog from "./MenuDetailDialog"

const PERIOD_ICONS: Record<MealPeriodLabel, typeof Sunrise> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Moon,
  DESSERT: CakeSlice,
  BEVERAGE: CupSoda,
}

export default function AllMenuTable() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState<MealPeriodLabel | "all">("all")
  const [detailTarget, setDetailTarget] = useState<MenuItem | null>(null)
  const [editDialog, setEditDialog] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  })
  const [hideDialog, setHideDialog] = useState<{ open: boolean; item: MenuItem | null }>({
    open: false,
    item: null,
  })
  const [hiding, setHiding] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getMenus()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu items")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeItems = useMemo(() => items.filter((i) => i.isAvailable), [items])

  const periodFiltered = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === "all") return activeItems
    return activeItems.filter((item) => item.mealTypes.includes(selectedPeriod))
  }, [activeItems, selectedPeriod])

  const searchedItems = useMemo(() => {
    if (!search) return periodFiltered
    const q = search.toLowerCase()
    return periodFiltered.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [periodFiltered, search])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(searchedItems)

  async function handleHide() {
    if (!hideDialog.item) return
    try {
      setHiding(true)
      await updateMenuAvailability(hideDialog.item.id, false)
      setItems((prev) => prev.map((i) =>
        i.id === hideDialog.item!.id ? { ...i, isAvailable: false } : i
      ))
      setHideDialog({ open: false, item: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discontinue menu")
    } finally {
      setHiding(false)
    }
  }

  const columns: Column[] = [
    { label: "Details", key: "details" },
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Price", key: "price" },
    { label: "Stock", key: "stock" },
    { label: "Actions", key: "actions", isAction: true, align: "right" },
  ]

  function renderCell(row: MenuItem, column: Column) {
    switch (column.key) {
      case "details":
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDetailTarget(row)}
          >
            <Eye size={14} className="mr-1" />
            Menu Details
          </Button>
        )
      case "image":
        return row.images.length > 0 ? (
          <img
            src={menuImageUrl(row.images[0]) ?? ""}
            alt={row.name}
            className="w-10 h-10 rounded object-cover mx-auto"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-admin-card-border mx-auto flex items-center justify-center text-admin-muted text-xs">
            N/A
          </div>
        )
      case "name":
        return <span className="font-medium">{row.name}</span>
      case "category":
        return <span>{row.category}</span>
      case "price":
        return <span>KSh {row.price}</span>
      case "stock":
        return <span>{row.stock}</span>
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditDialog({ open: true, editId: row.id })}
            >
              <Pencil size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setHideDialog({ open: true, item: row })}
            >
              <EyeOff size={14} className="mr-1" />
              Discontinue
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (loading) return <div className="text-admin-muted">Loading menu items...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center">
        All Restaurant Menu
      </Heading>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedPeriod("all")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            selectedPeriod === "all"
              ? "bg-green-600 text-white shadow-sm"
              : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
          )}
        >
          All
        </button>
        {MEAL_PERIODS.map((period) => {
          const Icon = PERIOD_ICONS[period]
          const isSelected = selectedPeriod === period
          return (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isSelected
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
              )}
            >
              <Icon size={14} />
              {period}
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
            ? "No menu items match your search."
            : "No menu items found."
        }
        header={
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
            <Input
              placeholder="Search by name, category..."
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

      <MenuDetailDialog
        open={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        menuId={detailTarget?.id ?? null}
      />

      <CreateMenuDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, editId: null })}
        editId={editDialog.editId}
        onSaved={loadData}
      />

      {hideDialog.open && hideDialog.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-popover rounded-xl p-6 shadow-lg ring-1 ring-foreground/10 w-full max-w-sm space-y-4">
            <Heading as="h3" className="text-admin-header-text">
              Discontinue Menu Item
            </Heading>
            <p className="text-sm text-admin-muted">
              Are you sure you want to discontinue &quot;{hideDialog.item.name}&quot;?
            </p>
            <p className="text-sm text-admin-muted">It will move to Discontinued Menus.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setHideDialog({ open: false, item: null })}
                disabled={hiding}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleHide}
                disabled={hiding}
              >
                {hiding ? "Discontinuing..." : "Discontinue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
