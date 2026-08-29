import { useCallback, useEffect, useState } from "react"
import { PackageOpen, RefreshCw, UtensilsCrossed, Layers } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getStockRemaining } from "@/lib/api"
import AssignmentModal from "./AssignmentModal"

interface Props {
  onAssigned?: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-KE", { dateStyle: "medium" })
}

export default function RemainingStockCard({ onAssigned }: Props) {
  const [data, setData] = useState<StockRemaining | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [assigning, setAssigning] = useState<{ open: boolean; batchId: string | null; title: string }>({
    open: false,
    batchId: null,
    title: "",
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const remaining = await getStockRemaining()
      setData(remaining)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remaining stock")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getStockRemaining()
      .then((remaining) => {
        if (cancelled) return
        setData(remaining)
        setError("")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load remaining stock")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasAny = Boolean(
    data && (data.carryForwardPerMenu.length > 0 || data.unassignedBatches.length > 0)
  )

  const handleAssigned = () => {
    setAssigning({ open: false, batchId: null, title: "" })
    void loadData()
    onAssigned?.()
  }

  if (loading) return <div className="text-admin-muted">Loading remaining stock...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!hasAny) {
    return (
      <div className="space-y-4">
        <Heading as="h2" className="text-admin-header-text text-center">
          Remaining Stock from Previous Shift
        </Heading>
        <Card>
          <CardContent className="p-8 text-center">
            <PackageOpen size={24} className="mx-auto mb-2 text-admin-muted" />
            <p className="text-sm text-admin-muted">
              {data?.previousShift
                ? "No carry-forward or unassigned stock from the previous shift."
                : "No previous shift data yet. Open and close a shift to see carry-over here."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCarryForward = (data?.carryForwardPerMenu ?? []).reduce(
    (sum, row) => sum + row.closingPlates,
    0
  )

  return (
    <div className="space-y-4">
      <Heading as="h2" className="text-admin-header-text text-center">
        Remaining Stock from Previous Shift
      </Heading>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen size={16} className="text-orange-600" />
            {data?.previousShift ? (
              <span>
                {data.previousShift.type === "DAY" ? "Day" : "Night"} shift ·{" "}
                {formatDate(data.previousShift.date)}
              </span>
            ) : (
              "Carry-forward"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data && data.carryForwardPerMenu.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                <Layers size={12} />
                Carry-forward by Menu
              </div>
              <div className="overflow-hidden rounded-md border border-admin-card-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-admin-card-border bg-muted text-xs text-admin-muted uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Menu</th>
                      <th className="px-3 py-2 text-right font-semibold">Carry-Forward (Closing)</th>
                      <th className="px-3 py-2 text-left font-semibold">Stock Supply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.carryForwardPerMenu.map((row, i) => (
                      <tr
                        key={`${row.menuId}-${i}`}
                        className="border-b border-admin-card-border last:border-b-0"
                      >
                        <td className="px-3 py-2 font-medium text-admin-header-text">{row.menuName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.closingPlates}</td>
                        <td className="px-3 py-2 text-admin-muted">{row.stockSupplyName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted">
                      <td className="px-3 py-2 font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {totalCarryForward}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {data && data.unassignedBatches.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                <UtensilsCrossed size={12} />
                Unassigned Carry-over (assign to menus)
              </div>
              <div className="overflow-hidden rounded-md border border-admin-card-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-admin-card-border bg-muted text-xs text-admin-muted uppercase">
                      <th className="px-3 py-2 text-left font-semibold">Stock Item</th>
                      <th className="px-3 py-2 text-left font-semibold">Stock Item Menus</th>
                      <th className="px-3 py-2 text-right font-semibold">Produced Plates</th>
                      <th className="px-3 py-2 text-right font-semibold">Assigned</th>
                      <th className="px-3 py-2 text-right font-semibold text-blue-600">Previous Sold</th>
                      <th className="px-3 py-2 text-right font-semibold">Available</th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unassignedBatches.map((batch) => (
                      <tr
                        key={batch.cookingRecordId}
                        className="border-b border-admin-card-border last:border-b-0"
                      >
                        <td className="px-3 py-2 font-medium text-admin-header-text">
                          {batch.stockSupplyName}
                        </td>
                        <td className="px-3 py-2">
                          {batch.menus.length === 0 ? (
                            <span className="text-admin-muted text-xs">—</span>
                          ) : (
                            <div className="flex flex-col items-start gap-0.5">
                              {batch.menus.map((m) => (
                                <span
                                  key={m.menuId}
                                  className="inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-medium bg-admin-content border border-admin-card-border whitespace-nowrap leading-tight"
                                >
                                  <span className="text-admin-header-text">{m.menuName}</span>
                                  <span className="rounded-full bg-red-500/15 text-red-600 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-tight">
                                    {m.platesAllocated}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{batch.totalProduced}</td>
                        <td className="px-3 py-2 text-right">
                          {batch.totalAssigned === 0 ? (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              {batch.totalAssigned} plates
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              {batch.totalAssigned} plates
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {batch.menus.length === 0 ? (
                            <span className="text-admin-muted text-xs">—</span>
                          ) : (
                            <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                              <div className="flex flex-col items-start gap-1">
                                {batch.menus.map((m) => (
                                  <span
                                    key={m.menuId}
                                    className="inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-medium bg-admin-content border border-admin-card-border whitespace-nowrap leading-tight"
                                  >
                                    <span className="text-admin-header-text">{m.menuName}</span>
                                    <span className="rounded-full bg-blue-500/15 text-blue-600 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-tight">
                                      {m.platesSold ?? 0}
                                    </span>
                                  </span>
                                ))}
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-700 border border-blue-200 whitespace-nowrap leading-tight shrink-0">
                                Total: <span className="tabular-nums">{batch.menus.reduce((sum, m) => sum + (m.platesSold ?? 0), 0)}</span>
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {batch.unassigned} plates
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAssigning({
                                open: true,
                                batchId: batch.cookingRecordId,
                                title: batch.stockSupplyName,
                              })
                            }
                          >
                            <RefreshCw size={12} className="mr-1" />
                            Assign Plates
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignmentModal
        open={assigning.open}
        onClose={() => setAssigning({ open: false, batchId: null, title: "" })}
        batchId={assigning.batchId}
        title={assigning.title}
        onRefresh={handleAssigned}
      />
    </div>
  )
}