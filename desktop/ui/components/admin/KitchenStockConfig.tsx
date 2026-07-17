import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Heading } from "@/components/ui/heading"
import { DataTable } from "@/components/ui/data-table"
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
import { Plus, Pencil, ArrowLeft } from "lucide-react"
import { getKitchenConfig, saveKitchenConfig, getStockSupplies } from "@/lib/api"
import { usePagination } from "@/hooks/usePagination"

interface Props {
  onBack: () => void
}

export default function KitchenStockConfig({ onBack }: Props) {
  const [configItems, setConfigItems] = useState<KitchenConfigItem[]>([])
  const [allSupplies, setAllSupplies] = useState<StockSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<KitchenConfigItem | null>(null)
  const [selectedSupplyId, setSelectedSupplyId] = useState("")
  const [platesPerUnit, setPlatesPerUnit] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError("")
    try {
      const [config, supplies] = await Promise.all([getKitchenConfig(), getStockSupplies()])
      setConfigItems(config)
      setAllSupplies(supplies)
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
    setSelectedSupplyId(item.id)
    setPlatesPerUnit(item.platesPerUnit?.toString() ?? "")
    setFormError("")
    setShowForm(true)
  }

  function openCreate() {
    setEditItem(null)
    setSelectedSupplyId("")
    setPlatesPerUnit("")
    setFormError("")
    setShowForm(true)
  }

  async function handleSave() {
    if (!selectedSupplyId) {
      setFormError("Stock item is required")
      return
    }
    const plates = parseFloat(platesPerUnit)
    if (!plates || plates <= 0) {
      setFormError("Plates per unit must be greater than 0")
      return
    }

    setSaving(true)
    setFormError("")
    try {
      await saveKitchenConfig(selectedSupplyId, { platesPerUnit: plates })
      setShowForm(false)
      await fetchAll()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const configuredIds = new Set(configItems.map((c) => c.id))
  const unconfiguredSupplies = allSupplies.filter((s) => !configuredIds.has(s.id))

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(configItems)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button onClick={onBack} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={openCreate} className="px-6 py-6 bg-brand-green hover:bg-brand-green/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Configuration
        </Button>
      </div>

      <Heading as="h2" className="mb-6 text-admin-header-text text-center uppercase">Kitchen Stock Configuration</Heading>

      <p className="text-sm text-admin-header-text/60 mb-4">
        Configure how stock items convert to menu plates. Set the plates per unit for each ingredient.
      </p>

      {loading && <p className="p-4 text-admin-header-text/60">Loading...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <DataTable
          columns={[
            { label: "Stock Item", key: "name" },
            { label: "Plates per Unit", key: "platesPerUnit" },
            { label: "Menu Item", key: "menu" },
            { label: "Actions", key: "actions", isAction: true, width: 120 },
          ]}
          data={paginatedItems}
          renderCell={(item, column) => {
            switch (column.key) {
              case "name":
                return <span className="font-medium text-admin-header-text">{item.name}</span>
              case "platesPerUnit":
                return <span className="text-admin-header-text">{item.platesPerUnit ?? "—"}</span>
              case "menu":
                return <span className="text-admin-header-text/60">{item.menu?.name ?? "—"}</span>
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
          emptyMessage="No configurations yet. Click 'Add Configuration' to get started."
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

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && setShowForm(false)}>
        <DialogContent className="min-h-[280px] p-8">
          <DialogHeader>
            <DialogTitle className="text-base uppercase text-center text-admin-header-text">
              {editItem ? "Edit Configuration" : "Add Configuration"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-admin-header-text">Stock Item *</label>
              <Select
                onValueChange={setSelectedSupplyId}
                value={selectedSupplyId}
                disabled={!!editItem}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select stock item" />
                </SelectTrigger>
                <SelectContent>
                  {!editItem && unconfiguredSupplies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.unit})
                    </SelectItem>
                  ))}
                  {editItem && (
                    <SelectItem value={editItem.id}>
                      {editItem.name} ({editItem.unit})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
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
