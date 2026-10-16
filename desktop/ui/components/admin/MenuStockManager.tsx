import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { getKitchenConfig, keyStockSupply, getMenus, updateMenu } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { cn } from "@/lib/utils"

type Tab = "keyed" | "direct-sale" | "shared" | "allocated"

const TABS: { key: Tab; label: string }[] = [
  { key: "keyed", label: "Keyed" },
  { key: "direct-sale", label: "Direct Sale" },
  { key: "shared", label: "Shared Pool" },
  { key: "allocated", label: "Allocated" },
]

interface Props {
  onBack: () => void
}

export default function MenuStockManager({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("keyed")

  const [configItems, setConfigItems] = useState<KitchenConfigItem[]>([])
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Keyed pool dialog
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [keyTarget, setKeyTarget] = useState<KitchenConfigItem | null>(null)
  const [keyedAmount, setKeyedAmount] = useState("")
  const [keyReason, setKeyReason] = useState("")
  const [keying, setKeying] = useState(false)

  // Direct sale stock dialog
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [stockTarget, setStockTarget] = useState<MenuItem | null>(null)
  const [stockAmount, setStockAmount] = useState("")
  const [stocking, setStocking] = useState(false)

  const [search, setSearch] = useState("")

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const [allConfigs, allMenus] = await Promise.all([getKitchenConfig(), getMenus()])
      setConfigItems(allConfigs)
      setMenus(allMenus)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const keyedItems = configItems.filter((i) => i.sellingMode === "KEYED")
  const directSaleItems = menus.filter((m) => m.requiresCooking === false)
  const sharedItems = menus.filter((m) => m.sellingMode === "SHARED")
  const allocatedItems = menus.filter((m) => m.sellingMode === "ALLOCATED")

  function activeItems() {
    switch (tab) {
      case "keyed":
        return keyedItems
      case "direct-sale":
        return directSaleItems
      case "shared":
        return sharedItems
      case "allocated":
        return allocatedItems
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = activeItems().filter((item) => {
    if ("platesPerUnit" in item) {
      const i = item as KitchenConfigItem
      return (
        i.name.toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q) ||
        i.menus.some((m) => m.name.toLowerCase().includes(q))
      )
    }
    const m = item as MenuItem
    return (
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.supplyNames?.some((n) => n.toLowerCase().includes(q))
    )
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

  function openSetPool(item: KitchenConfigItem) {
    setKeyTarget(item)
    setKeyedAmount(String(item.keyedStock ?? 0))
    setKeyReason("")
    setKeyDialogOpen(true)
  }

  async function handleSetPool() {
    if (!keyTarget) return
    const amount = parseFloat(keyedAmount)
    if (Number.isNaN(amount) || amount < 0) {
      setError("Keyed amount must be 0 or more")
      return
    }
    setKeying(true)
    setError("")
    try {
      await keyStockSupply(keyTarget.id, amount, keyReason.trim() || undefined)
      setKeyDialogOpen(false)
      setKeyTarget(null)
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setKeying(false)
    }
  }

  function openSetStock(item: MenuItem) {
    setStockTarget(item)
    setStockAmount(String(item.stock ?? 0))
    setStockDialogOpen(true)
  }

  async function handleSetStock() {
    if (!stockTarget) return
    const amount = parseFloat(stockAmount)
    if (Number.isNaN(amount) || amount < 0) {
      setError("Stock amount must be 0 or more")
      return
    }
    setStocking(true)
    setError("")
    try {
      await updateMenu(stockTarget.id, { stock: amount })
      setStockDialogOpen(false)
      setStockTarget(null)
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStocking(false)
    }
  }

  const columns = (() => {
    switch (tab) {
      case "keyed":
        return [
          { label: "Stock Item", key: "name" },
          { label: "Unit", key: "unit" },
          { label: "Current Pool", key: "pool" },
          { label: "Menu Items", key: "menu" },
          { label: "Actions", key: "actions", isAction: true },
        ]
      case "direct-sale":
        return [
          { label: "Menu Name", key: "name" },
          { label: "Category", key: "category" },
          { label: "Price", key: "price" },
          { label: "Current Stock", key: "stock" },
          { label: "Menu Types", key: "mealTypes" },
          { label: "Actions", key: "actions", isAction: true },
        ]
      case "shared":
        return [
          { label: "Menu Name", key: "name" },
          { label: "Category", key: "category" },
          { label: "Shared Plates", key: "sharedPlates" },
          { label: "Available Plates", key: "availablePlates" },
          { label: "Supply Names", key: "supplyNames" },
        ]
      case "allocated":
        return [
          { label: "Menu Name", key: "name" },
          { label: "Category", key: "category" },
          { label: "Allocated Plates", key: "allocatedPlates" },
          { label: "Available Plates", key: "availablePlates" },
          { label: "Supply Names", key: "supplyNames" },
        ]
    }
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-6 text-admin-header-text text-center">Menu Stock Manager</Heading>

      <p className="text-sm text-admin-header-text/60 mb-4 text-center">
        Central place to adjust menu dish stock. Keyed supplies and direct-sale items can be
        edited here; shared-pool and allocated dishes are listed for quick access only.
      </p>

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-admin-card-border">
            {TABS.map(({ key, label }) => {
              const isActive = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "border-b-2 border-primary text-primary font-semibold"
                      : "text-admin-muted hover:text-admin-header-text",
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <DataTable
            columns={columns}
            data={paginatedItems}
            renderCell={(item, column) => {
              if ("platesPerUnit" in item) {
                const i = item as KitchenConfigItem
                switch (column.key) {
                  case "name":
                    return <span className="font-medium text-admin-header-text">{i.name}</span>
                  case "unit":
                    return <span className="text-admin-header-text">{i.unit}</span>
                  case "pool":
                    return (
                      <span className="text-admin-header-text font-medium">{i.keyedStock ?? 0}</span>
                    )
                  case "menu":
                    return i.menus && i.menus.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {i.menus.map((m) => (
                          <span key={m.id} className="text-xs px-2 py-0.5 rounded border border-admin-card-border text-admin-header-text/70">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-admin-header-text/60">—</span>
                    )
                  case "actions":
                    return tab === "keyed" ? (
                      <Button variant="ghost" size="sm" onClick={() => openSetPool(i)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Set Pool
                      </Button>
                    ) : null
                  default:
                    return null
                }
              }
              const m = item as MenuItem
              switch (column.key) {
                case "name":
                  return <span className="font-medium text-admin-header-text">{m.name}</span>
                case "category":
                  return <span className="text-admin-header-text">{m.category}</span>
                case "price":
                  return <span className="text-admin-header-text">KSh {m.price}</span>
                case "stock":
                  return (
                    <span className="text-admin-header-text font-medium tabular-nums">
                      {m.stock ?? 0}
                    </span>
                  )
                case "sharedPlates":
                  return (
                    <span className="text-admin-header-text font-medium tabular-nums">
                      {m.sharedPlates ?? 0}
                    </span>
                  )
                case "allocatedPlates":
                  return (
                    <span className="text-admin-header-text font-medium tabular-nums">
                      {m.allocatedPlates ?? 0}
                    </span>
                  )
                case "availablePlates":
                  return (
                    <span className="text-admin-header-text tabular-nums">
                      {m.availablePlates ?? 0}
                    </span>
                  )
                case "supplyNames":
                  return m.supplyNames && m.supplyNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {m.supplyNames.map((n) => (
                        <span key={n} className="text-xs px-2 py-0.5 rounded border border-admin-card-border text-admin-header-text/70">
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-admin-header-text/60">—</span>
                  )
                case "mealTypes":
                  return (
                    <span className="text-admin-header-text/60 text-xs">
                      {m.mealTypes.join(", ")}
                    </span>
                  )
                case "actions":
                  return tab === "direct-sale" ? (
                    <Button variant="ghost" size="sm" onClick={() => openSetStock(m)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Set Stock
                    </Button>
                  ) : null
                default:
                  return null
              }
            }}
            keyExtractor={(item) => {
              if ("platesPerUnit" in item) return item.id
              return item.id
            }}
            emptyMessage={
              search.trim()
                ? `No items match "${search.trim()}".`
                : "No items found."
            }
            header={
              <Input
                placeholder="Search by name, category, unit, or menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
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
        </div>
      )}

      {/* Keyed pool dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={(o) => !o && setKeyDialogOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              Set Pool — {keyTarget?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Pool amount (plates)</label>
              <p className="text-xs text-admin-header-text/50 mb-2">
                This is the value as it stands now, not a top-up. A higher figure is logged as
                Received; a lower one as an Adjustment.
              </p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={keyedAmount}
                onChange={(e) => setKeyedAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-admin-header-text">Reason (optional)</label>
              <Input
                placeholder="e.g. Counted 6 eggs this morning"
                value={keyReason}
                onChange={(e) => setKeyReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setKeyDialogOpen(false)} disabled={keying}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSetPool} disabled={keying} className="bg-brand-green hover:bg-brand-green/90">
              {keying ? "Setting..." : "Set Pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct sale stock dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={(o) => !o && setStockDialogOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              Set Stock — {stockTarget?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Stock count</label>
              <p className="text-xs text-admin-header-text/50 mb-2">
                This is the value as it stands now for this direct-sale menu item.
              </p>
              <Input
                type="number"
                min="0"
                step="1"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setStockDialogOpen(false)} disabled={stocking}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSetStock} disabled={stocking} className="bg-brand-green hover:bg-brand-green/90">
              {stocking ? "Saving..." : "Set Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
