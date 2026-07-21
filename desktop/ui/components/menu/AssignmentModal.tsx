import { useState, useEffect, useCallback } from "react"
import { Pencil, Trash2, Plus } from "lucide-react"
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
  createCookingAssignment,
  updateCookingAssignment,
  deleteCookingAssignment,
  getMenus,
} from "@/lib/api"

interface AssignmentRow {
  id: string
  menuId: string
  menuName: string
  quantityPlates: number
}

interface CookedItemData {
  stockSupplyId: string
  stockSupplyName: string
  cookedDate: string
  totalProduced: number
  totalAssigned: number
  totalAvailable: number
  assignments: AssignmentRow[]
}

interface Props {
  open: boolean
  onClose: () => void
  cookedItem: CookedItemData | null
  onRefresh: () => void
}

export default function AssignmentModal({ open, onClose, cookedItem, onRefresh }: Props) {
  const [allMenus, setAllMenus] = useState<{ id: string; name: string }[]>([])
  const [newMenuId, setNewMenuId] = useState("")
  const [newQuantity, setNewQuantity] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadMenus = useCallback(async () => {
    try {
      const menus = await getMenus()
      setAllMenus(menus.map((m) => ({ id: m.id, name: m.name })))
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadMenus()
      setNewMenuId("")
      setNewQuantity("")
      setEditingId(null)
      setRemovingId(null)
      setError("")
    }
  }, [open, loadMenus])

  if (!cookedItem) return null

  const assignedMenuIds = new Set(cookedItem.assignments.map((a) => a.menuId))
  const availableMenus = allMenus.filter((m) => !assignedMenuIds.has(m.id))
  const availablePlates = cookedItem.totalAvailable

  async function handleAdd() {
    if (!cookedItem) return
    const qty = parseInt(newQuantity, 10)
    if (!newMenuId) { setError("Select a menu variant"); return }
    if (!qty || qty <= 0) { setError("Enter a valid quantity"); return }
    if (qty > availablePlates) { setError(`Only ${availablePlates} plates available`); return }

    setError("")
    setSubmitting(true)
    try {
      await createCookingAssignment({
        stockSupplyId: cookedItem.stockSupplyId,
        date: cookedItem.cookedDate,
        menuId: newMenuId,
        quantityPlates: qty,
      })
      setNewMenuId("")
      setNewQuantity("")
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add assignment")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(assignmentId: string) {
    const qty = parseInt(editQuantity, 10)
    if (!qty || qty <= 0) { setError("Enter a valid quantity"); return }
    if (qty > availablePlates) { setError(`Only ${availablePlates} plates available`); return }

    setError("")
    setSubmitting(true)
    try {
      await updateCookingAssignment(assignmentId, { quantityPlates: qty })
      setEditingId(null)
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update assignment")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    setError("")
    setSubmitting(true)
    try {
      await deleteCookingAssignment(assignmentId)
      setRemovingId(null)
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove assignment")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base uppercase text-admin-header-text">
            Assign Plates: {cookedItem.stockSupplyName}
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
              <p className="text-lg font-semibold text-admin-header-text">{cookedItem.totalAssigned}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-admin-muted">Available</p>
              <p className={`text-lg font-semibold ${availablePlates <= 0 ? "text-red-600" : "text-green-600"}`}>
                {availablePlates}
              </p>
            </div>
          </div>

          {/* Current Assignments */}
          <div>
            <p className="text-sm font-medium text-admin-header-text mb-2">Current Assignments</p>
            {cookedItem.assignments.length === 0 ? (
              <p className="text-xs text-admin-muted py-2">No assignments yet.</p>
            ) : (
              <div className="border border-admin-card-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-admin-content">
                      <th className="text-left px-3 py-2 text-xs font-medium text-admin-muted">Menu Variant</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-admin-muted">Plates</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-admin-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookedItem.assignments.map((a) => (
                      <tr key={a.id} className="border-t border-admin-card-border">
                        <td className="px-3 py-2 text-admin-header-text">{a.menuName}</td>
                        <td className="px-3 py-2 text-center">
                          {editingId === a.id ? (
                            <input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 border border-input rounded px-2 py-1 text-center text-sm"
                              min={1}
                            />
                          ) : (
                            a.quantityPlates
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editingId === a.id ? (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-green-600"
                                onClick={() => handleSaveEdit(a.id)}
                                disabled={submitting}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-admin-muted"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : removingId === a.id ? (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-600"
                                onClick={() => handleRemove(a.id)}
                                disabled={submitting}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-admin-muted"
                                onClick={() => setRemovingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => {
                                  setEditingId(a.id)
                                  setEditQuantity(String(a.quantityPlates))
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-600"
                                onClick={() => setRemovingId(a.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add New Assignment */}
          <div>
            <p className="text-sm font-medium text-admin-header-text mb-2">Add New Assignment</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Menu Variant</Label>
                <select
                  value={newMenuId}
                  onChange={(e) => setNewMenuId(e.target.value)}
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select variant...</option>
                  {availableMenus.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plates</Label>
                <input
                  type="number"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder={`Max ${availablePlates}`}
                  min={1}
                  max={availablePlates}
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                onClick={handleAdd}
                disabled={submitting || !newMenuId || !newQuantity}
                className="w-full"
              >
                <Plus size={14} className="mr-1" />
                Add Assignment
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
