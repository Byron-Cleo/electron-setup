import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"

const UNIT_LABELS: Record<string, string> = {
  KG: "Kilogram",
  PKT: "Packet",
  L: "Litre",
  ML: "Millilitre",
  PCS: "Pieces",
}
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { getKitchenConfig, saveKitchenConfig } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"
import { cn } from "@/lib/utils"

interface Props {
  onBack: () => void
}

export default function KitchenStockConfig({ onBack }: Props) {
  const [configItems, setConfigItems] = useState<KitchenConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<KitchenConfigItem | null>(null)
  const [platesPerUnit, setPlatesPerUnit] = useState("")
  const [sellingMode, setSellingMode] = useState<SellingMode>("ALLOCATED")
  const [factors, setFactors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      setConfigItems(await getKitchenConfig())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  function openEdit(item: KitchenConfigItem) {
    setEditItem(item)
    setPlatesPerUnit(item.platesPerUnit?.toString() ?? "")
    setSellingMode(item.sellingMode ?? "ALLOCATED")
    setFactors(
      Object.fromEntries(item.menus.map((m) => [m.id, String(m.platesPerServing ?? 1)])),
    )
    setFormError("")
    setShowForm(true)
  }

  // A shared pool is consumed whole by any dish on it, so every dish and
  // portion must cost the same rate. Warn before submitting rather than
  // letting the server reject it.
  const nonFlatDishes = editItem
    ? editItem.menus.filter((m) => Number(factors[m.id] ?? 1) !== 1)
    : []
  const hasFlatPortions = editItem?.menus.some((m) =>
    (m.portions ?? []).some((p) => Number(p.platesPerServing) !== 1),
  )
  const sharedBlocked = sellingMode === "SHARED" && (nonFlatDishes.length > 0 || hasFlatPortions === true)

  async function handleSave() {
    if (!editItem) return
    const plates = parseFloat(platesPerUnit)
    if (!plates || plates <= 0) {
      setFormError("Plates per unit must be greater than 0")
      return
    }
    if (sharedBlocked) {
      setFormError(
        "A shared pool must use a flat 1-for-1 rate. Set every dish and portion below to 1 first.",
      )
      return
    }

    setSaving(true)
    setFormError("")
    try {
      await saveKitchenConfig(editItem.id, {
        platesPerUnit: plates,
        sellingMode,
        menuFactors: editItem.menus.map((m) => ({
          menuId: m.id,
          platesPerServing: Number(factors[m.id] ?? 1),
        })),
      })
      setShowForm(false)
      await fetchAll()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredConfigItems = configItems.filter((item) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.unit.toLowerCase().includes(q) ||
      item.menus.some((m) => m.name.toLowerCase().includes(q))
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
  } = usePagination(filteredConfigItems)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-6 text-admin-header-text text-center">Stock-Kitchen Configuration</Heading>

      <p className="text-sm text-red-500 mb-4">
        Configure how stock items convert to menu plates. Every stock item is listed here — search for
        the item, then use Edit to set the plates per unit.
      </p>

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={[
            { label: "Stock Item", key: "name" },
            { label: "Unit", key: "unit" },
            { label: "Plates per Unit", key: "platesPerUnit" },
            { label: "Engine", key: "engine" },
            { label: "Menu Items", key: "menu" },
            { label: "Status", key: "status" },
            { label: "Actions", key: "actions", isAction: true },
          ]}
          data={paginatedItems}
          renderCell={(item, column) => {
            switch (column.key) {
              case "name":
                return <span className="font-medium text-admin-header-text">{item.name}</span>
              case "unit":
                return <span className="text-admin-header-text">{item.unit} <span className="text-admin-header-text/50">({UNIT_LABELS[item.unit] ?? item.unit})</span></span>
              case "platesPerUnit":
                return <span className="text-admin-header-text">{item.platesPerUnit ?? "—"}</span>
              case "engine":
                return item.sellingMode === "SHARED" ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/30">
                    Shared pool
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-admin-content text-admin-header-text/70 border border-admin-card-border">
                    Allocated
                  </span>
                )
              case "menu":
                return item.menus && item.menus.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.menus.map((m) => (
                      <span
                        key={m.id}
                        className="text-xs px-2 py-0.5 rounded bg-admin-content text-admin-header-text/70 border border-admin-card-border"
                      >
                        {m.name}
                        {m.platesPerServing !== 1 && (
                          <span className="ml-1 text-amber-600">×{m.platesPerServing}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-admin-header-text/60">—</span>
                )
              case "status":
                return item.platesPerUnit != null && item.platesPerUnit > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/30">
                    Configured
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30">
                    Not set
                  </span>
                )
              case "actions":
                return (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )
              default:
                return null
            }
          }}
          keyExtractor={(item) => item.id}
          emptyMessage={search.trim()
            ? `No stock items match "${search.trim()}".`
            : "No stock items available to configure."}
          header={
            <Input
              placeholder="Search by item, unit, or menu..."
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
      )}

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[280px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              Edit Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Stock Item</label>
              <p className="mt-1 text-sm text-admin-header-text/70">
                {editItem ? `${editItem.name} (${editItem.unit})` : "—"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-admin-header-text">Plates per Unit *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={platesPerUnit}
                onChange={(e) => setPlatesPerUnit(e.target.value)}
                placeholder="e.g. 6"
                className="mt-1"
              />
              <p className="text-xs text-admin-header-text/50 mt-1">
                How many plates does 1 unit of this ingredient produce?
              </p>
            </div>

            {/* Engine */}
            <div>
              <label className="text-sm font-medium text-admin-header-text">Selling Engine *</label>
              <div className="mt-2 space-y-2">
                {(
                  [
                    {
                      value: "ALLOCATED",
                      title: "Allocated",
                      blurb:
                        "A manager splits each tray between dishes. Only the allocated amounts can be ordered; anything left over carries over untouched.",
                    },
                    {
                      value: "SHARED",
                      title: "Shared pool",
                      blurb:
                        "The whole tray is sellable through every dish on this item, with no allocation step. Requires every dish and portion to use a flat 1-for-1 rate.",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSellingMode(option.value)}
                    className={cn(
                      "w-full text-left rounded-md border px-3 py-2 transition-colors",
                      sellingMode === option.value
                        ? "border-brand-green bg-brand-green/10"
                        : "border-admin-card-border hover:bg-admin-content",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-admin-header-text">
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full border-2",
                          sellingMode === option.value ? "border-brand-green bg-brand-green" : "border-admin-card-border",
                        )}
                      />
                      {option.title}
                    </span>
                    <span className="mt-1 block text-xs text-admin-header-text/60">{option.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-dish consumption rates */}
            {editItem && editItem.menus.length > 0 && (
              <div>
                <label className="text-sm font-medium text-admin-header-text">
                  Plates per Serving (per dish)
                </label>
                <p className="text-xs text-admin-header-text/50 mt-1">
                  How much of the pool one serving uses. Use 0.5 for a half portion (e.g. Boiled Meat
                  Half), 2 for a two-piece portion (e.g. Fried Eggs 2pc).
                </p>
                <div className="mt-2 space-y-2">
                  {editItem.menus.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-admin-header-text">{m.name}</span>
                      {(m.portions ?? []).map((p) => (
                        <span key={p.id} className="text-xs text-admin-header-text/50">
                          {p.name} ×{p.platesPerServing}
                        </span>
                      ))}
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={factors[m.id] ?? "1"}
                        onChange={(e) =>
                          setFactors((f) => ({ ...f, [m.id]: e.target.value }))
                        }
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
                {sharedBlocked && (
                  <p className="mt-2 text-xs text-amber-600">
                    Shared pools need a flat 1-for-1 rate. Set these to 1:{" "}
                    {nonFlatDishes.map((m) => m.name).join(", ")}
                    {hasFlatPortions ? " (and every portion listed above)" : ""}.
                  </p>
                )}
              </div>
            )}
          </div>
          {formError && <p className="text-sm text-red-500 text-center mt-2">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-green hover:bg-brand-green/90">
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
