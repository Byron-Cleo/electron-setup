import { useCallback, useEffect, useState } from "react"
import { Trash2, PackageOpen, Undo2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getWastedStock, unwasteWastedBatch } from "@/lib/api"

function formatDay(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatShiftLabel(type: string | null): string {
  if (!type) return "—"
  return type === "DAY" ? "Day" : "Night"
}

export default function WastedStockCard({ search = "" }: { search?: string }) {
  const [batches, setBatches] = useState<WastedStockBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [unwastingId, setUnwastingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ open: boolean; batch: WastedStockBatch | null }>({
    open: false,
    batch: null,
  })
  const [unwasteError, setUnwasteError] = useState("")

  const load = useCallback(() => {
    getWastedStock()
      .then((data) => {
        setBatches(data.wastedBatches)
        setError("")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load wasted stock")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openConfirm(batch: WastedStockBatch) {
    setUnwasteError("")
    setConfirming({ open: true, batch })
  }

  async function handleUnwaste() {
    const batch = confirming.batch
    if (!batch) return
    setUnwastingId(batch.cookingRecordId)
    setUnwasteError("")
    try {
      await unwasteWastedBatch(batch.cookingRecordId)
      setConfirming({ open: false, batch: null })
      load()
    } catch (e) {
      setUnwasteError(e instanceof Error ? e.message : "Failed to unwaste batch")
    } finally {
      setUnwastingId(null)
    }
  }

  const totalWasted = batches.reduce((sum, b) => sum + b.wastedQty, 0)

  const filteredBatches = batches.filter((batch) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return batch.stockSupplyName.toLowerCase().includes(q)
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trash2 size={16} className="text-red-600" />
          Wasted Stock
        </CardTitle>
        <p className="text-xs text-admin-muted">
          Batches marked as wasted while unassigned. Waste is attributed to the operation date the
          batch was produced — even if it was wasted from a later operation date.
        </p>
      </CardHeader>

      {loading ? (
        <CardContent>
          <div className="text-admin-muted">Loading wasted stock...</div>
        </CardContent>
      ) : error ? (
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      ) : batches.length === 0 ? (
        <CardContent className="p-8 text-center">
          <PackageOpen size={24} className="mx-auto mb-2 text-admin-muted" />
          <p className="text-sm text-admin-muted">No wasted batches yet.</p>
        </CardContent>
      ) : (
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-admin-card-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-card-border bg-muted text-xs text-admin-muted uppercase">
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Op Date</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Shift</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Stock Item</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Produced</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Sold</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Assigned</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Wasted</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Marked on</th>
                  <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => (
                  <tr
                    key={batch.cookingRecordId}
                    className="border-b border-admin-card-border last:border-b-0"
                  >
                    <td className="px-3 py-2 text-center whitespace-nowrap text-admin-muted">
                      {formatDay(batch.operationDay)}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span
                        className={
                          batch.shiftType === "DAY"
                            ? "inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
                            : "inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
                        }
                      >
                        {formatShiftLabel(batch.shiftType)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-admin-header-text whitespace-nowrap">
                      {batch.stockSupplyName}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{batch.totalProduced}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{batch.soldTotal}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{batch.totalAssigned}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 tabular-nums">
                        {batch.wastedQty}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap text-admin-muted">
                      {formatTime(batch.disposedAt)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                        disabled={unwastingId === batch.cookingRecordId}
                        onClick={() => openConfirm(batch)}
                      >
                        {unwastingId === batch.cookingRecordId ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Undo2 size={12} className="mr-1" />
                        )}
                        Unwaste
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-admin-card-border bg-muted">
                  <td colSpan={7} className="px-3 py-2 text-right font-medium text-admin-header-text">
                    Total Wasted
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white tabular-nums">
                      {totalWasted}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}

      <Dialog
        open={confirming.open}
        onOpenChange={(open) => {
          if (!open) setConfirming({ open: false, batch: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unwaste this batch?</DialogTitle>
            <DialogDescription>
              This will reverse the waste on{" "}
              <span className="font-medium">{confirming.batch?.stockSupplyName}</span> (
              {confirming.batch?.wastedQty} plates) and return the plates to sellable stock. Use this
              only if the batch was marked as wasted by mistake.
            </DialogDescription>
          </DialogHeader>
          {unwasteError && <p className="text-sm text-red-600">{unwasteError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming({ open: false, batch: null })}
              disabled={unwastingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 text-white hover:bg-amber-700"
              disabled={unwastingId !== null}
              onClick={() => void handleUnwaste()}
            >
              {unwastingId ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Undo2 size={12} className="mr-1" />
              )}
              Unwaste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}