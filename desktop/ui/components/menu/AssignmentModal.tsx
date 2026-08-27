import { useState, useEffect } from "react"
import { Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  upsertCookingAssignment,
  deleteCookingAssignment,
} from "@/lib/api"

interface AssignmentRow {
  id: string
  menuId: string
  menuName: string
  quantityPlates: number
}

interface CookedItemData {
  menuId: string
  menuName: string
  stockSupplyId: string
  stockSupplyName: string
  cookedDate: string
  totalProduced: number
  totalAssigned: number
  totalAvailable: number
  assignments: AssignmentRow[]
  cookingRecordId?: string
  menuAssigned: number
}

interface Props {
  open: boolean
  onClose: () => void
  cookedItem: CookedItemData | null
  onRefresh: () => void
}

export default function AssignmentModal({ open, onClose, cookedItem, onRefresh }: Props) {
  const [quantity, setQuantity] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (open && cookedItem) {
      const existing = cookedItem.assignments.find((a) => a.menuId === cookedItem.menuId)
      setQuantity(existing ? String(existing.quantityPlates) : "")
      setError("")
    }
  }, [open, cookedItem])

  if (!cookedItem) return null

  const existingAssignment = cookedItem.assignments.find((a) => a.menuId === cookedItem.menuId)
  const menuAssigned = cookedItem.assignments.reduce(
    (sum, a) => sum + a.quantityPlates,
    0
  )

  // Available from kitchen pool (produced minus all assigned across all menus)
  const kitchenAvailable = cookedItem.totalAvailable
  // For validation: allow editing this menu's own assignment (free it back into the pool)
  const maxAllowed = kitchenAvailable + (existingAssignment ? existingAssignment.quantityPlates : 0)

  async function handleSave() {
    if (!cookedItem?.cookingRecordId) { setError("No cooking record found"); return }
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) { setError("Enter a valid quantity"); return }
    if (qty > maxAllowed) { setError(`Cannot assign more plates than the produced amount (${maxAllowed})`); return }

    setError("")
    setSubmitting(true)
    try {
      await upsertCookingAssignment({
        cookingRecordId: cookedItem.cookingRecordId,
        menuId: cookedItem.menuId,
        quantityPlates: qty,
      })
      onRefresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save assignment")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    if (!existingAssignment) return
    setError("")
    setRemoving(true)
    try {
      await deleteCookingAssignment(existingAssignment.id)
      setQuantity("")
      onRefresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove assignment")
    } finally {
      setRemoving(false)
    }
  }

  const qtyNum = quantity === "" ? 0 : parseInt(quantity, 10)
  const canSave = qtyNum > 0 && qtyNum <= maxAllowed && !submitting

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm text-admin-header-text">
            Assign Plates: <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{cookedItem.menuName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-admin-content border border-admin-card-border">
            <div className="text-center">
              <p className="text-xs text-admin-muted">Produced</p>
              <p className="text-lg font-semibold text-admin-header-text">{cookedItem.totalProduced}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-admin-muted">Assigned</p>
              <p className="text-lg font-semibold text-admin-header-text">{menuAssigned}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-admin-muted">Available</p>
              <p className={`text-lg font-semibold ${kitchenAvailable <= 0 ? "text-red-600" : "text-green-600"}`}>
                {kitchenAvailable}
              </p>
            </div>
          </div>

          {/* Current Assignment Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-admin-content border border-admin-card-border">
            <div>
              <p className="text-xs text-admin-muted">Menu Item</p>
              <p className="text-sm font-medium text-admin-header-text">{cookedItem.menuName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-admin-muted">Current Plates</p>
              <p className={`text-sm font-semibold ${existingAssignment ? "text-green-600" : "text-admin-muted"}`}>
                {existingAssignment ? existingAssignment.quantityPlates : "Not assigned"}
              </p>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-1">
            <Label className="text-xs">
              {existingAssignment ? "Add More Plates" : "Assign Plates"}
            </Label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Max ${maxAllowed}`}
              min={1}
              max={maxAllowed}
              className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
            />
            {qtyNum > 0 && qtyNum > maxAllowed && (
              <p className="text-[11px] text-red-500 font-semibold uppercase mt-1">
                Cannot assign more plates than the produced amount
              </p>
            )}
            {qtyNum > 0 && qtyNum <= maxAllowed && (
              <p className="text-[11px] text-green-600 mt-1">
                {existingAssignment ? `${existingAssignment.quantityPlates} + ${qtyNum} = ${existingAssignment.quantityPlates + qtyNum} plates total` : "Plates will be assigned"}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {existingAssignment && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleRemove}
              disabled={removing || submitting}
            >
              <Trash2 size={14} className="mr-1" />
              {removing ? "Removing..." : "Remove"}
            </Button>
          )}
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleSave}
            disabled={!canSave}
          >
            {submitting ? "Saving..." : existingAssignment ? <><Plus size={14} className="mr-1" /> Add More</> : <><Plus size={14} className="mr-1" /> Assign</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
