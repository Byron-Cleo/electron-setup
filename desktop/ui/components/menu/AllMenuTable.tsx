import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Eye, Pencil, EyeOff, Sunrise, Sun, Moon, CakeSlice, CupSoda, RotateCcw } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/ui/data-table"
import { usePagination } from "@/hooks/usePagination"
import { getMenus, updateMenuAvailability } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getActiveMealPeriods, type MealPeriodLabel } from "@/lib/mealPeriod"
import CreateMenuDialog from "./CreateMenuDialog"
import MenuDetailDialog from "./MenuDetailDialog"

type StatusTab = "all" | "available" | "soldout"

const TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Selling Now" },
  { key: "soldout", label: "Sold Out" },
]

const PERIOD_ICONS: Record<MealPeriodLabel, typeof Sunrise> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Moon,
  DESSERT: CakeSlice,
  BEVERAGE: CupSoda,
}

function getMenuStatus(item: MenuItem): { label: string; className: string } {
  if ((item.stock ?? 0) > 0) return { label: "Selling Now", className: "bg-green-100 text-green-700" }
  return { label: "Sold Out", className: "bg-orange-100 text-orange-700" }
}

function getDefaultPeriod(): MealPeriodLabel {
  const now = new Date().getHours()
  const periods = getActiveMealPeriods(now)
  return periods.find((p) => p.isActive)?.period ?? "BREAKFAST"
}

export default function AllMenuTable() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [hour, setHour] = useState(new Date().getHours())
  const [selectedPeriod, setSelectedPeriod] = useState<MealPeriodLabel>(getDefaultPeriod)
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
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; item: MenuItem | null }>({
    open: false,
    item: null,
  })
  const [restoring, setRestoring] = useState(false)

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

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000)
    return () => clearInterval(id)
  }, [])

  const mealPeriods = useMemo(() => getActiveMealPeriods(hour), [hour])

  const activePeriods = mealPeriods.filter((p) => p.isActive)
  const closedPeriods = mealPeriods.filter((p) => !p.isActive)

  const activeItems = useMemo(() => items.filter((i) => i.isAvailable), [items])
  const discontinuedItems = useMemo(() => items.filter((i) => !i.isAvailable), [items])

  const periodFiltered = useMemo(() => {
    if (!selectedPeriod) return activeItems
    return activeItems.filter((item) => item.mealTypes.includes(selectedPeriod))
  }, [activeItems, selectedPeriod])

  const counts = useMemo(() => ({
    all: periodFiltered.length,
    available: periodFiltered.filter((i) => i.isAvailable && (i.stock ?? 0) > 0).length,
    soldout: periodFiltered.filter((i) => i.isAvailable && (i.stock ?? 0) <= 0).length,
  }), [periodFiltered])

  const statusFiltered = useMemo(() => {
    if (statusTab === "all") return periodFiltered
    return periodFiltered.filter((item) => {
      const isAvailable = item.isAvailable && (item.stock ?? 0) > 0
      const isSoldOut = item.isAvailable && (item.stock ?? 0) <= 0
      switch (statusTab) {
        case "available": return isAvailable
        case "soldout": return isSoldOut
        default: return true
      }
    })
  }, [periodFiltered, statusTab])

  const searchedItems = useMemo(() => {
    if (!search) return statusFiltered
    const q = search.toLowerCase()
    return statusFiltered.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [statusFiltered, search])

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
      setError(err instanceof Error ? err.message : "Failed to hide menu")
    } finally {
      setHiding(false)
    }
  }

  async function handleRestore() {
    if (!restoreDialog.item) return
    try {
      setRestoring(true)
      await updateMenuAvailability(restoreDialog.item.id, true)
      setItems((prev) => prev.map((i) =>
        i.id === restoreDialog.item!.id ? { ...i, isAvailable: true } : i
      ))
      setRestoreDialog({ open: false, item: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore menu")
    } finally {
      setRestoring(false)
    }
  }

  const columns: Column[] = [
    { label: "Details", key: "details" },
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Price", key: "price" },
    { label: "Stock", key: "stock" },
    { label: "Status", key: "status" },
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
            src={row.images[0]}
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
      case "status": {
        const { label, className } = getMenuStatus(row)
        return (
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", className)}>
            {label}
          </span>
        )
      }
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
              Hide
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  const disconColumns: Column[] = [
    { label: "Image", key: "image" },
    { label: "Name", key: "name" },
    { label: "Category", key: "category" },
    { label: "Actions", key: "actions", isAction: true, align: "right" },
  ]

  function renderDisconCell(row: MenuItem, column: Column) {
    switch (column.key) {
      case "image":
        return row.images.length > 0 ? (
          <img
            src={row.images[0]}
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
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => setRestoreDialog({ open: true, item: row })}
            >
              <RotateCcw size={14} className="mr-1" />
              Restore
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

      <div className="flex flex-wrap items-start gap-6">
        {activePeriods.length > 0 && (
          <section>
            <Heading as="h3" className="text-xs text-green-600 uppercase tracking-wider mb-2">Now Serving</Heading>
            <div className="flex flex-wrap gap-2">
              {activePeriods.map((p) => {
                const Icon = PERIOD_ICONS[p.period]
                const isSelected = selectedPeriod === p.period
                return (
                  <button
                    key={p.period}
                    onClick={() => setSelectedPeriod(p.period)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-green-600 text-white shadow-sm"
                        : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
                    )}
                  >
                    <Icon size={14} />
                    {p.period}
                    {p.badgeLabel !== "Now Serving" && p.badgeLabel !== "Always Available" && (
                      <span className="text-[10px] opacity-75">({p.servingHours})</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {closedPeriods.length > 0 && (
          <section>
            <Heading as="h3" className="text-xs text-red-500 uppercase tracking-wider mb-2">Closed</Heading>
            <div className="flex flex-wrap gap-2">
              {closedPeriods.map((p) => {
                const Icon = PERIOD_ICONS[p.period]
                return (
                  <button
                    key={p.period}
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-60 cursor-not-allowed bg-red-50 text-red-500 border border-red-200"
                  >
                    <Icon size={14} />
                    {p.period}
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map(({ key, label }) => {
          const isActive = statusTab === key
          return (
            <button
              key={key}
              onClick={() => setStatusTab(key)}
              className={cn(
                "flex flex-col items-center px-4 py-3 h-auto rounded-lg cursor-pointer transition-colors",
                key === "all" && "mr-auto",
                isActive && key === "all" && "bg-admin-accent/60 text-white",
                isActive && key === "available" && "bg-green-500/60 text-white",
                isActive && key === "soldout" && "bg-red-500/60 text-white",
                !isActive && key === "all" && "border-4 border-admin-accent/40 text-admin-accent",
                !isActive && key === "available" && "border-4 border-green-400 text-green-600",
                !isActive && key === "soldout" && "border-4 border-red-400 text-red-500",
              )}
            >
              <span className="text-sm font-bold leading-tight">{label}</span>
              <span className={cn(
                "mt-0.5 text-xs font-bold rounded-full px-2 py-0.5",
                isActive && "bg-white/20 text-white",
                !isActive && key === "all" && "bg-admin-accent/10 text-admin-accent",
                !isActive && key === "available" && "bg-green-100 text-green-600",
                !isActive && key === "soldout" && "bg-red-100 text-red-500",
              )}>
                {counts[key]}
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

      {discontinuedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Discontinued Menus</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={disconColumns}
              data={discontinuedItems}
              renderCell={renderDisconCell}
              keyExtractor={(row) => row.id}
              emptyMessage="No discontinued menus."
            />
          </CardContent>
        </Card>
      )}

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
              Hide Menu Item
            </Heading>
            <p className="text-sm text-admin-muted">
              Are you sure you want to hide &quot;{hideDialog.item.name}&quot;?
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
                {hiding ? "Hiding..." : "Hide"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {restoreDialog.open && restoreDialog.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-popover rounded-xl p-6 shadow-lg ring-1 ring-foreground/10 w-full max-w-sm space-y-4">
            <Heading as="h3" className="text-admin-header-text">
              Restore Menu Item
            </Heading>
            <p className="text-sm text-admin-muted">
              Restore &quot;{restoreDialog.item.name}&quot; to the active menu?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setRestoreDialog({ open: false, item: null })}
                disabled={restoring}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={handleRestore}
                disabled={restoring}
              >
                {restoring ? "Restoring..." : "Restore"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
