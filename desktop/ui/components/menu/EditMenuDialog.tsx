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
  const [platesToAdd, setPlatesToAdd] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setPlatesToAdd("")
      setError("")
    }
  }, [item])

  const totalProduced = item?.cooking.totalProduced ?? 0
  const currentStock = item?.stock ?? 0
  const addNum = platesToAdd === "" ? 0 : Number(platesToAdd)
  const newTotal = currentStock + addNum
  const maxToAdd = item ? item.cooking.totalAvailable : 0
  const canSave = addNum > 0 && addNum <= maxToAdd

  async function handleSave() {
    if (!item || !canSave) return

    try {
      setSaving(true)
      setError("")
      await updateMenu(item.id, { stock: newTotal })
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
            <div className="space-y-3 bg-gray-100 p-4 rounded-lg">
              {/* Current Stock Display */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Current Plates:</span>
                <span className={`font-bold ${currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {currentStock}
                </span>
              </div>

              {/* Available from Kitchen */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Available from Kitchen:</span>
                <span className="font-medium text-blue-600">{totalProduced} plates</span>
              </div>

              {/* Add Plates Input */}
              <div className="pt-2 border-t border-gray-200">
                <Label htmlFor="add-plates" className="text-sm font-medium">
                  Add Plates
                </Label>
                <Input
                  id="add-plates"
                  type="number"
                  min="0"
                  max={maxToAdd}
                  value={platesToAdd}
                  onChange={(e) => setPlatesToAdd(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
                {addNum > 0 && addNum > maxToAdd ? (
                  <p className="text-[11px] text-red-500 font-semibold uppercase mt-1">
                    Cannot exceed {maxToAdd} plates available from kitchen
                  </p>
                ) : addNum > 0 ? (
                  <p className="text-[11px] text-green-600 mt-1">
                    New total will be {newTotal} plates
                  </p>
                ) : (
                  <p className="text-[11px] text-yellow-600 mt-1">
                    Enter number of plates to add from kitchen production
                  </p>
                )}
              </div>
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
            {saving ? "Saving..." : "Add Plates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
