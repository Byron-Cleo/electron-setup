import { useEffect, useState } from "react"
import { Trash2, PackageOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getWastedStock } from "@/lib/api"

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

export default function WastedStockCard() {
  const [batches, setBatches] = useState<WastedStockBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    getWastedStock()
      .then((data) => {
        if (cancelled) return
        setBatches(data.wastedBatches)
        setError("")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load wasted stock")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const totalWasted = batches.reduce((sum, b) => sum + b.wastedQty, 0)

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
          <div className="overflow-hidden rounded-md border border-admin-card-border">
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
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
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
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-admin-card-border bg-muted">
                  <td colSpan={6} className="px-3 py-2 text-right font-medium text-admin-header-text">
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
    </Card>
  )
}