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
import { getCookingRecord, allocateCookingRecord, getMenus, updateMenu } from "@/lib/api"

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
  stock: number
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
            stock: 0,
            // DB source of truth: sold/opening come from the open shift's
            // snapshots via the batch endpoint — never availability buckets.
            soldThisShift: record.menuSolds?.[sm.menu.id] ?? 0,
            openingStock: record.menuOpenings?.[sm.menu.id] ?? 0,
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
        // The shift window comes from the batch endpoint (snapshot-derived).
        if (record.shift) {
          const start = new Date(record.shift.openingTime).getTime()
          const end = new Date(record.shift.autoCloseTime).getTime()
          const createdAt = new Date(record.createdAt).getTime()
          setIsCarryOver(!(createdAt >= start && createdAt < end))
        }

        // Fetch current menu stock for each linked menu
        getMenus().then((allMenus) => {
          if (cancelled) return
          const menuStockMap = new Map(allMenus.map((m) => [m.id, m.stock ?? 0]))
          setMenus((prev) =>
            prev.map((menu) => ({
              ...menu,
              stock: menuStockMap.get(menu.id) ?? 0,
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

  // Correct allocation logic:
  // Each menu is independent. Remaining pool is shared.
  // menu.stock = actual menu stock from database (source of truth)
  // + button limited by Remaining Pool (shared)
  // - button limited by menu.stock per menu (independent)
  // Sale removes plates from the system permanently (does not return to pool)
  // Sold plates reduce the pool; deduct returns the plate to the pool
  // Remaining Pool = produced - allocated - sold (+/- uncommitted deltas)

  const totalAllocated = menus.reduce((sum, menu) => sum + menu.existingAllocated, 0)
  const totalSold = menus.reduce((sum, menu) => sum + menu.soldThisShift, 0)
  const totalDelta = menus.reduce((sum, menu) => sum + (deltas[menu.id] ?? 0), 0)
  const remainingPool = produced - (totalAllocated + totalSold + totalDelta)
  const overCap = (totalAllocated + totalSold + totalDelta) > produced
  const canSave = menus.length > 0 && !overCap

  const updateDelta = (menuId: string, value: number) => {
    const menu = menus.find((m) => m.id === menuId)
    if (!menu) return
    // Current stock for this menu = menu.stock (from database)
    const currentStock = menu.stock
    const maxDelta = remainingPool + (deltas[menuId] ?? 0)  // + limited by pool
    const minDelta = -currentStock  // - limited by current stock (can't deduct more than in stock)
    const clamped = Math.max(minDelta, Math.min(value, maxDelta))
    setDeltas((prev) => ({ ...prev, [menuId]: clamped }))
  }

  const increment = (menuId: string) => {
    const current = deltas[menuId] ?? 0
    if (current < remainingPool + current) {
      updateDelta(menuId, current + 1)
    }
  }

  const decrement = (menuId: string) => {
    const current = deltas[menuId] ?? 0
    const menu = menus.find((m) => m.id === menuId)
    if (!menu) return
    const currentStock = menu.stock
    const newStock = currentStock + current - 1
    if (newStock >= 0) {
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

      // Update menu stock for each menu
      const stockUpdates = menus.map((menu) => {
        const delta = deltas[menu.id] ?? 0
        const newStock = menu.stock + delta
        return updateMenu(menu.id, { stock: newStock })
      })
      await Promise.all(stockUpdates)

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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-admin-muted">Produced Plates:</span>
                  <span className="font-bold text-lg">{produced} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-orange-600">Sold Plates:</span>
                  <span className="font-bold text-lg text-orange-600">{totalSold} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-green-600">Selling Now Plates:</span>
                  <span className="font-bold text-lg text-green-600">{totalAllocated} plates</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-blue-600">Remaining Plates:</span>
                  <span className={`font-bold text-lg text-blue-600`}>
                    {remainingPool} plates
                  </span>
                </div>
              </div>
              {isCarryOver && (
                <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  Carry-over batch from previous shift. Assign plates to restock current shift.
                </div>
              )}
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
                menus.map((menu) => {
                  const currentStock = menu.stock
                  return (
                    <div key={menu.id} className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <Label className="text-xs font-medium truncate">{menu.name}</Label>
                        <div className="flex items-center gap-3 text-[11px] text-admin-muted">
                          <span>Open Stk: <span className="font-medium text-admin-header-text">{menu.openingStock}</span></span>
                          <span className="text-green-600">Selling Now: <span className="font-medium">{currentStock}</span></span>
                          <span className="text-orange-600">Sold: <span className="font-medium text-orange-600">{menu.soldThisShift}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => decrement(menu.id)}
                            disabled={submitting || currentStock + (deltas[menu.id] ?? 0) <= 0}
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
                            disabled={submitting || (deltas[menu.id] ?? 0) >= remainingPool + (deltas[menu.id] ?? 0)}
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