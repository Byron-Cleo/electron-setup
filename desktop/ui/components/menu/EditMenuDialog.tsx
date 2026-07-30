import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateMenu } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  item: CookedMenuItem | null
  onSaved: () => void
}

export default function EditMenuDialog({ open, onClose, item, onSaved }: Props) {
  const [stock, setStock] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setStock(String(item.stock ?? ""))
      setError("")
    }
  }, [item])

  const totalProduced = item?.cooking.totalProduced ?? 0
  const stockNum = stock === "" ? 0 : Number(stock)
  const currentStock = item?.stock ?? 0
  const maxStock = item ? item.cooking.totalAvailable + currentStock : 0
  const canSave = stockNum > 0 && stockNum <= maxStock

  async function handleSave() {
    if (!item || !canSave) return

    try {
      setSaving(true)
      setError("")
      await updateMenu(item.id, { stock: stockNum })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update menu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="bg-green-200 px-2 py-0.5 rounded">{item?.name ?? "MenuDish"}</span> Plate Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {totalProduced > 0 ? (
            <div className="space-y-2 bg-gray-100 p-4 rounded-lg">
              <Label htmlFor="edit-stock">Stock (Plates)</Label>
              <Input
                id="edit-stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
              {stockNum > 0 && stockNum > maxStock ? (
                <p className="text-[11px] text-red-500 font-semibold uppercase">
                  Only {maxStock} plates remaining after other menu assignments
                </p>
              ) : (
                <p className="text-[11px] text-yellow-600">
                  Sets the quantity of plates waiters can bill through the POS
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-admin-muted text-center py-4">
              No kitchen production recorded yet for this item
            </p>
          )}

          {error && <p className="text-sm text-red-500 font-semibold uppercase">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
