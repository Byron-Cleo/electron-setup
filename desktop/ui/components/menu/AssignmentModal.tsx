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
import { getCookingRecord, allocateCookingRecord, getMenus, getMenuStockStatus, getCurrentShift } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  batchId: string | null
  title: string
  onRefresh: () => void
}

interface MenuWithStock {
  id: string
  name: string
  existingAllocated: number
  currentStock: number
  soldThisShift: number
  openingStock: number
}

export default function AssignmentModal({ open, onClose, batchId, title, onRefresh }: Props) {
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [produced, setProduced] = useState(0)
  const [menus, setMenus] = useState<MenuWithStock[]>([])
  const [isCarryOver, setIsCarryOver] = useState(false)

  useEffect(() => {
    if (!open || !batchId) return
    let cancelled = false
    getCookingRecord(batchId)
      .then((record) => {
        if (cancelled) return
        const producedTotal = Number(record.platesActual ?? record.platesExpected)
        const linkedMenus: MenuWithStock[] = record.stockSupply.menus.map((sm) => {
          const split = record.cookingRecordMenus.find((crm) => crm.menuId === sm.menu.id)
          return {
            id: sm.menu.id,
            name: sm.menu.name,
            existingAllocated: split ? Number(split.platesRemaining) : 0,
            currentStock: 0,
            soldThisShift: 0,
            openingStock: 0,
          }
        })
        const initialDeltas: Record<string, number> = {}
        for (const menu of linkedMenus) {
          initialDeltas[menu.id] = 0
        }
        setLoading(false)
        setError("")
        setProduced(producedTotal)
        setMenus(linkedMenus)
        setDeltas(initialDeltas)
        setIsCarryOver(false)

        // A batch produced outside the current shift's time window is carry-over
        // from the previous shift — label it as such instead of "Produced".
        getCurrentShift().then((shift) => {
          if (cancelled || !shift) return
          const start = new Date(shift.openingTime).getTime()
          const end = new Date(shift.autoCloseTime).getTime()
          const createdAt = new Date(record.createdAt).getTime()
          setIsCarryOver(!(createdAt >= start && createdAt < end))
        }).catch(() => {})

        // Fetch current menu stock for each linked menu
        getMenus().then((allMenus) => {
          if (cancelled) return
          const menuStockMap = new Map(allMenus.map((m) => [m.id, m.stock ?? 0]))
          setMenus((prev) =>
            prev.map((menu) => ({
              ...menu,
              currentStock: menuStockMap.get(menu.id) ?? 0,
            }))
          )
        }).catch(() => {})

        // Fetch shift-based sold count and opening stock for each menu
        getMenuStockStatus().then((status) => {
          if (cancelled) return
          const soldMap = new Map<string, number>()
          const openingMap = new Map<string, number>()
          for (const item of status.selling) {
            soldMap.set(item.id, item.sold)
            openingMap.set(item.id, item.opening)
          }
          for (const item of status.soldOut) {
            soldMap.set(item.id, item.sold)
            openingMap.set(item.id, item.opening)
          }
          for (const item of status.runningLow) {
            soldMap.set(item.id, item.sold)
            openingMap.set(item.id, item.opening)
          }
          setMenus((prev) =>
            prev.map((menu) => ({
              ...menu,
              soldThisShift: soldMap.get(menu.id) ?? 0,
              openingStock: openingMap.get(menu.id) ?? 0,
            }))
          )
        }).catch(() => {})
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

  const totalExisting = menus.reduce((sum, menu) => sum + menu.existingAllocated, 0)
  const totalSold = menus.reduce((sum, menu) => sum + menu.soldThisShift, 0)
  const totalOpening = menus.reduce((sum, menu) => sum + menu.openingStock, 0)
  const totalCurrent = menus.reduce((sum, menu) => sum + menu.currentStock, 0)
  const totalRemainingFromShift = menus.reduce((sum, menu) => {
    const remaining = menu.currentStock - menu.openingStock
    return sum + (remaining > 0 ? remaining : 0)
  }, 0)
  const totalAllocatedFromShift = totalSold + totalRemainingFromShift
  const totalAllocated = isCarryOver ? totalExisting : totalAllocatedFromShift || totalExisting
  const totalDelta = menus.reduce((sum, menu) => sum + (deltas[menu.id] ?? 0), 0)
  const newTotalAllocated = totalAllocated + totalDelta
  const remaining = produced - newTotalAllocated
  const overCap = newTotalAllocated > produced

  // Drift check: currentStock + sold should equal openingStock + produced
  const expectedTotal = totalOpening + produced
  const actualTotal = totalCurrent + totalSold
  const drift = actualTotal - expectedTotal

  const canSave = totalDelta !== 0 && !overCap && !submitting && menus.length > 0

  const updateDelta = (menuId: string, value: number) => {
    const menu = menus.find((m) => m.id === menuId)
    if (!menu) return
    const maxDelta = remaining + (deltas[menuId] ?? 0)
    const minDelta = -menu.currentStock
    const clamped = Math.max(minDelta, Math.min(value, maxDelta))
    setDeltas((prev) => ({ ...prev, [menuId]: clamped }))
  }

  const increment = (menuId: string) => {
    const current = deltas[menuId] ?? 0
    if (current < remaining + current) {
      updateDelta(menuId, current + 1)
    }
  }

  const decrement = (menuId: string) => {
    const current = deltas[menuId] ?? 0
    const menu = menus.find((m) => m.id === menuId)
    const newTotalStock = (menu?.currentStock ?? 0) + current - 1
    if (newTotalStock >= 0) {
      updateDelta(menuId, current - 1)
    }
  }

  const handleSave = async () => {
    if (!batchId) return
    setError("")
    setSubmitting(true)
    try {
      const payload = menus.map((menu) => ({
        menuId: menu.id,
        plates: menu.existingAllocated + (deltas[menu.id] ?? 0),
      }))
      await allocateCookingRecord(batchId, payload)
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
            <div className="rounded-md bg-muted p-3 text-sm">
              {isCarryOver ? (
                <div>
                  Carry-over: <span className="font-medium">{produced} plates</span>
                </div>
              ) : (
                <div>
                  Produced: <span className="font-medium">{produced} plates</span>
                </div>
              )}
              <div className="text-xs text-admin-muted">
                {isCarryOver
                  ? "This batch is from the previous shift. Assign its plates to restock menu items in the current shift."
                  : "Batch produced within the current shift."}
              </div>
              <div>
                Allocated {isCarryOver ? "(carry-over)" : "This Shift"}:{" "}
                <span className="font-medium text-blue-600">{totalAllocated} plates</span>
              </div>
              <div>
                Sold This Shift:{" "}
                <span className="font-medium text-orange-600">{totalSold} plates</span>
              </div>
              <div>
                Remaining This Shift:{" "}
                <span className="font-medium text-green-600">{totalRemainingFromShift} plates</span>
              </div>
              <div>
                After Changes:{" "}
                <span className={`font-medium ${overCap ? "text-red-600" : "text-blue-600"}`}>
                  {newTotalAllocated} / {produced} plates
                </span>
              </div>
              <div>
                Remaining:{" "}
                <span className={`font-medium ${remaining <= 0 ? "text-red-600" : "text-blue-600"}`}>
                  {remaining} plates
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="text-xs text-admin-muted">Opening Stk: {totalOpening}</div>
                <div className="text-xs text-admin-muted">Current Stk: {totalCurrent}</div>
                <div className="text-xs text-admin-muted">
                  Unallocated: {drift >= 0 ? "+" : ""}{drift} plates
                </div>
              </div>
              {overCap && (
                <p className="text-xs text-red-600 mt-1">
                  Cannot allocate more than {produced} produced plates.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {menus.length === 0 ? (
                <p className="text-sm text-admin-muted">
                  No menu items are linked to this batch&apos;s stock item.
                </p>
              ) : (
                menus.map((menu) => (
                  <div key={menu.id} className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0 flex-1">
                      <Label className="text-xs font-medium truncate">{menu.name}</Label>
                      <div className="flex items-center gap-3 text-[11px] text-admin-muted">
                        <span>Open Stk: <span className="font-medium text-admin-header-text">{menu.openingStock}</span></span>
                        <span>Cur. Stk: <span className="font-medium text-admin-header-text">{menu.currentStock}</span></span>
                        <span>Sold Stk: <span className="font-medium text-orange-600">{menu.soldThisShift}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => decrement(menu.id)}
                          disabled={submitting || (menu.currentStock + (deltas[menu.id] ?? 0)) <= 0}
                          className="h-8 w-8"
                        >
                          <Minus size={14} />
                        </Button>
                        <Input
                          type="number"
                          step={1}
                          value={deltas[menu.id] ?? 0}
                          onChange={(e) => updateDelta(menu.id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => increment(menu.id)}
                          disabled={submitting || (deltas[menu.id] ?? 0) >= remaining + (deltas[menu.id] ?? 0)}
                          className="h-8 w-8"
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
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