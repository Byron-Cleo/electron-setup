import { useState, useEffect } from "react"
import { RefreshCw, Plus, Minus } from "lucide-react"
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
import { getCookingRecord, allocateCookingRecord } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  batchId: string | null
  title: string
  onRefresh: () => void
  expired?: boolean
}

interface MenuSplit {
  id: string
  name: string
  /** Plates of THIS batch assigned (allocated) to the dish. */
  assigned: number
  /** Plates of THIS batch already sold through the dish. */
  sold: number
}

export default function AssignmentModal({ open, onClose, batchId, title, onRefresh, expired = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [produced, setProduced] = useState(0)
  const [menus, setMenus] = useState<MenuSplit[]>([])
  const [isCarryOver, setIsCarryOver] = useState(false)
  const [origin, setOrigin] = useState("")
  const [carryFrom, setCarryFrom] = useState("")

  useEffect(() => {
    if (!open || !batchId) return
    let cancelled = false
    getCookingRecord(batchId)
      .then((record) => {
        if (cancelled) return
        const producedTotal = Number(record.platesActual ?? record.platesExpected)
        // Everything shown here is scoped to THIS batch alone: assigned comes
        // from the batch's own splits, sold from the batch's allocation ledger
        // (batchSoldByMenu). Shift-wide snapshot totals are never used, so an
        // earlier batch's sales cannot bleed into a newer batch's numbers.
        const linkedMenus: MenuSplit[] = record.stockSupply.menus.map((sm) => {
          const split = record.cookingRecordMenus.find((crm) => crm.menuId === sm.menu.id)
          return {
            id: sm.menu.id,
            name: sm.menu.name,
            assigned: split ? Number(split.platesAllocated) : 0,
            sold: record.batchSoldByMenu?.[sm.menu.id] ?? 0,
          }
        })
        setLoading(false)
        setError("")
        setProduced(producedTotal)
        setMenus(linkedMenus)
        setIsCarryOver(false)
        setCarryFrom("")

        // Where the batch came from — batch number, cook time, and the shift it
        // was cooked in. This is the carry-forward trail that survives shifts:
        // the batch (and its unsold leftovers) belongs to its own shift, not to
        // whatever shift is running when you open this modal.
        const cookedAt = new Date(record.createdAt)
        const originParts: string[] = []
        if (record.batchNumber != null) originParts.push(`Batch #${record.batchNumber}`)
        originParts.push(`cooked ${cookedAt.toLocaleString()}`)
        if (record.cookedInShift) originParts.push(`${record.cookedInShift.type} shift`)
        setOrigin(originParts.join(" · "))

        // A batch produced outside the current shift's time window is carry-over
        // from the previous shift — name the source shift instead of "Produced".
        if (record.shift) {
          const start = new Date(record.shift.autoOpenTime).getTime()
          const end = new Date(record.shift.autoCloseTime).getTime()
          const carry = !(cookedAt.getTime() >= start && cookedAt.getTime() < end)
          setIsCarryOver(carry)
          if (carry) {
            setCarryFrom(
              record.cookedInShift
                ? `${record.cookedInShift.type} shift on ${new Date(record.cookedInShift.autoOpenTime).toLocaleDateString()}`
                : "a previous shift",
            )
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false)
          setError(e instanceof Error ? e.message : "Failed to load batch")
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, batchId])

  if (!open) return null

  // Batch-scoped arithmetic — everything is about THIS batch alone:
  //   produced  = plates cooked in the batch
  //   assigned  = plates handed to dishes (allocated)
  //   sold      = plates of the batch already sold (never un-assignable)
  //   remaining = produced − assigned  (still to hand out to dishes)
  // A dish's own leftover = assigned − sold.
  const totalAssigned = menus.reduce((sum, m) => sum + m.assigned, 0)
  const totalSold = menus.reduce((sum, m) => sum + m.sold, 0)
  const remaining = produced - totalAssigned
  const overCap = totalAssigned > produced
  const canSave = menus.length > 0 && !overCap

  const setAssigned = (menuId: string, value: number) => {
    setMenus((prev) => {
      const pool = produced - prev.reduce((s, m) => s + m.assigned, 0)
      return prev.map((m) => {
        if (m.id !== menuId) return m
        // Never below what the dish already sold from this batch; never draw
        // more than the batch's unassigned pool.
        const min = m.sold
        const max = m.assigned + pool
        const clamped = Math.max(min, Math.min(value, max))
        return { ...m, assigned: clamped }
      })
    })
  }

  const increment = (m: MenuSplit) => {
    if (remaining >= 1) setAssigned(m.id, m.assigned + 1)
  }

  const decrement = (m: MenuSplit) => {
    if (m.assigned - m.sold >= 1) setAssigned(m.id, m.assigned - 1)
  }

  const handleSave = async () => {
    if (!batchId) return
    setError("")
    setSubmitting(true)
    try {
      // `plates` is the new ASSIGNED amount per dish. The server preserves the
      // batch's sold plates (remaining = assigned − sold) so a reallocation can
      // never resurrect stock an order already consumed. Omitting zero-assigned
      // dishes clears their split.
      const payload = menus
        .filter((m) => m.assigned > 0)
        .map((m) => ({ menuId: m.id, plates: m.assigned }))
      await allocateCookingRecord(batchId, payload)

      // Menu.stock is deliberately NOT written from here. The server derives it
      // from the pool for every affected dish and returns stockUpdates; writing
      // a client-computed value would race with concurrent orders and could
      // resurrect plates an order already consumed.
      onRefresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to allocate plates")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm text-admin-header-text">
            Assign Plates:{" "}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
              {title}
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-admin-muted text-sm">
            <RefreshCw size={14} className="animate-spin" /> Loading batch...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm space-y-2">
              {origin && (
                <div className="text-[11px] text-admin-muted">{origin}</div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-admin-muted">Produced Plates:</span>
                  <span className="font-bold text-lg">{produced} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-green-600">Assigned Plates:</span>
                  <span className="font-bold text-lg text-green-600">{totalAssigned} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-orange-600">Sold Plates:</span>
                  <span className="font-bold text-lg text-orange-600">{totalSold} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-blue-600">Remaining Plates:</span>
                  <span className={`font-bold text-lg ${overCap ? "text-red-600" : "text-blue-600"}`}>
                    {remaining} plates
                  </span>
                </div>
              </div>
              {expired && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                  Expired unassigned batch from a previous operation date (valid = 0).
                  This carry-over is a manual exception — assigning it is a manager decision.
                </div>
              )}
              {!expired && isCarryOver && (
                <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  Carried over from the {carryFrom}. Plates left below are still sellable this
                  shift — reassign only if you need to move them.
                </div>
              )}
              {overCap && (
                <p className="text-xs text-red-600 mt-1">
                  Cannot assign more than {produced} produced plates.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {menus.length === 0 ? (
                <p className="text-sm text-admin-muted">
                  No menu items are linked to this batch&apos;s stock item.
                </p>
              ) : (
                menus.map((menu) => {
                  const left = menu.assigned - menu.sold
                  return (
                    <div key={menu.id} className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <Label className="text-xs font-medium truncate">{menu.name}</Label>
                        <div className="flex items-center gap-3 text-[11px] text-admin-muted">
                          <span className="text-green-600">Assigned: <span className="font-medium">{menu.assigned}</span></span>
                          <span className="text-orange-600">Sold: <span className="font-medium">{menu.sold}</span></span>
                          <span className="text-blue-600">Left: <span className="font-medium">{left}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => decrement(menu)}
                            disabled={submitting || left <= 0}
                            className="h-8 w-8"
                          >
                            <Minus size={14} />
                          </Button>
                          <Input
                            type="number"
                            step={1}
                            value={menu.assigned}
                            onChange={(e) => setAssigned(menu.id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center"
                            readOnly
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => increment(menu)}
                            disabled={submitting || remaining <= 0}
                            className="h-8 w-8"
                          >
                            <Plus size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            onClick={handleSave}
            disabled={!canSave || loading}
          >
            {submitting ? <><RefreshCw size={14} className="mr-1 animate-spin" /> Saving...</> : "Save Menu Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}