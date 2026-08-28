import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Eye, Printer } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { closeShift, getShiftReport, previewShiftReport, printShiftReport } from "@/lib/api"
import { cn } from "@/lib/utils"

function money(amount: number): string {
  return `KSH ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" })
}

function driftLabel(minutes: number | null, verb: "Opened" | "Closed"): string {
  if (minutes === null) return "—"
  if (minutes === 0) return `${verb} on time`
  const magnitude = Math.abs(minutes)
  const early = minutes < 0
  const hours = Math.floor(magnitude / 60)
  const mins = magnitude % 60
  let duration: string
  if (hours > 0 && mins > 0) duration = `${hours} h ${mins} min`
  else if (hours > 0) duration = `${hours} h`
  else duration = `${mins} min`
  return `${verb} ${duration} ${early ? "early" : "late"}`
}

interface Props {
  shift: Shift
  closedById: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: () => void
}

function ShiftCloseDialog({ shift, closedById, open, onOpenChange, onClosed }: Props) {
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  const stats = useMemo(() => {
    const orders = shift.orders ?? []
    const active = orders.filter((o) => !o.isVoid)
    const revenueByMealType: Record<string, { orders: number; total: number }> = {}
    let revenue = 0
    for (const order of active) {
      revenue += Number(order.totalPrice)
      const entry = (revenueByMealType[order.mealType] ??= { orders: 0, total: 0 })
      entry.orders += 1
      entry.total += Number(order.totalPrice)
    }
    return {
      totalOrders: orders.length,
      voidedOrders: orders.length - active.length,
      unvoidedOrders: active.length,
      revenue,
      revenueByMealType,
    }
  }, [shift])

  const enforceCloseTime = import.meta.env.VITE_ENFORCE_SHIFT_CLOSE_TIME === "true"
  const pastAutoClose = enforceCloseTime
    ? new Date() > new Date(shift.autoCloseTime)
    : true

  async function handleCloseShift() {
    setClosing(true)
    setError(null)
    try {
      await closeShift(shift.id, closedById)
      const data = await getShiftReport(shift.id)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift")
    } finally {
      setClosing(false)
    }
  }

  function handleDismiss() {
    // If a close already succeeded, let the parent refresh its shift state
    if (report) onClosed()
    onOpenChange(false)
    // Reset after the dialog unmounts so reopening shows the confirm view again
    setTimeout(() => {
      setReport(null)
      setError(null)
      setClosing(false)
      setPreviewHtml(null)
    }, 200)
  }

  function toReportData(r: ShiftReport): ShiftReportData {
    return {
      restaurant: {
        name: "ERAEVA RESTAURANT",
        branch: "Airport",
        address: "Nairobi",
        poweredBy: "Apydy Technologies",
        tel: "0701315250",
      },
      shift: {
        type: r.shift.type,
        date: r.shift.date,
        openingTime: r.shift.openingTime,
        autoCloseTime: r.shift.autoCloseTime,
        actualOpeningTime: r.shift.actualOpeningTime,
        actualCloseTime: r.shift.actualCloseTime,
        openingDriftMinutes: r.shift.openingDriftMinutes,
        closingDriftMinutes: r.shift.closingDriftMinutes,
        driftMinutes: r.shift.driftMinutes,
        openedBy: r.shift.openedBy?.name ?? "—",
        closedBy: r.shift.closedBy?.name,
      },
      summary: r.summary,
      revenue: r.revenue,
      plateMovement: r.plateMovement,
      production: r.production,
    }
  }

  async function handlePreview() {
    if (!report) return
    try {
      const html = await previewShiftReport(toReportData(report))
      setPreviewHtml(html)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate preview")
    }
  }

  async function handlePrint() {
    if (!report) return
    setPrinting(true)
    try {
      const result = await printShiftReport(toReportData(report))
      if (!result.ok) {
        alert(result.error ?? "Print failed")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to print")
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {!report ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Close {shift.type === "DAY" ? "Day" : "Night"} Shift
              </DialogTitle>
              <DialogDescription>
                Review this shift before locking it. Counts and revenue below are final once
                closed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {pastAutoClose && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This shift is past its scheduled close time ({formatTime(shift.autoCloseTime)}
                    ). Closing now will record a drift against it.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="text-admin-muted">Opened</div>
                <div className="font-medium">
                  {formatTime(shift.openingTime)} by {shift.openedBy?.name ?? "—"}
                </div>
                <div className="text-admin-muted">Scheduled close</div>
                <div className="font-medium">{formatTime(shift.autoCloseTime)}</div>
                <div className="text-admin-muted">Total orders</div>
                <div className="font-medium">{stats.totalOrders}</div>
                <div className="text-admin-muted">Voided</div>
                <div className="font-medium text-red-600">{stats.voidedOrders}</div>
                <div className="text-admin-muted">Unvoided (locks at close)</div>
                <div className="font-medium">{stats.unvoidedOrders}</div>
                <div className="text-admin-muted">Revenue</div>
                <div className="font-semibold">{money(stats.revenue)}</div>
              </div>

              {Object.keys(stats.revenueByMealType).length > 0 && (
                <div className="rounded-lg border border-admin-card-border p-4">
                  <p className="mb-2 text-sm font-medium text-admin-header-text">
                    Revenue by meal period
                  </p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(stats.revenueByMealType).map(([mealType, entry]) => (
                      <div key={mealType} className="flex items-center justify-between">
                        <span className="text-admin-muted">
                          {mealType} ({entry.orders})
                        </span>
                        <span>{money(entry.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDismiss} disabled={closing}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCloseShift}
                disabled={closing || !pastAutoClose}
                title={!pastAutoClose ? "Shift can only be closed after its scheduled close time." : ""}
              >
                {closing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Closing...
                  </>
                ) : pastAutoClose ? (
                  "Confirm Close"
                ) : (
                  `Closes ${formatTime(shift.autoCloseTime)}`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Shift Report — {report.shift.type === "DAY" ? "Day" : "Night"}
              </DialogTitle>
              <DialogDescription>
                {formatDate(report.shift.date)} · opened {formatTime(report.shift.openingTime)} ·
                closed {formatTime(report.shift.actualCloseTime)} by{" "}
                {report.shift.closedBy?.name ?? "—"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-admin-muted">Orders</p>
                  <p className="text-lg font-bold text-admin-header-text">
                    {report.summary.totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Voided</p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      report.summary.voidedOrders > 0 ? "text-red-600" : "text-admin-header-text",
                    )}
                  >
                    {report.summary.voidedOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Revenue</p>
                  <p className="text-lg font-bold text-admin-header-text">
                    {money(report.revenue.total)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-admin-muted">Drift</p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      report.shift.driftMinutes > 15 ? "text-amber-600" : "text-green-600",
                    )}
                  >
                    {report.shift.driftMinutes > 0 ? `${report.shift.driftMinutes}m` : "On time"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-admin-card-border p-4">
                <p className="mb-2 text-sm font-medium text-admin-header-text">
                  Shift Clocking Summary
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-admin-muted">Defined open time</div>
                  <div>{formatTime(report.shift.openingTime)}</div>
                  <div className="text-admin-muted">Actual open time</div>
                  <div>{formatTime(report.shift.actualOpeningTime)}</div>
                  <div className="text-admin-muted">Opening drift</div>
                  <div className={cn(report.shift.openingDriftMinutes !== 0 && "text-amber-600")}>
                    {driftLabel(report.shift.openingDriftMinutes, "Opened")}
                  </div>

                  <div className="col-span-2 border-t border-admin-card-border" />

                  <div className="text-admin-muted">Defined close time</div>
                  <div>{formatTime(report.shift.autoCloseTime)}</div>
                  <div className="text-admin-muted">Actual close time</div>
                  <div>{formatTime(report.shift.actualCloseTime)}</div>
                  <div className="text-admin-muted">Closing drift</div>
                  <div className={cn(report.shift.closingDriftMinutes !== 0 && "text-amber-600")}>
                    {driftLabel(report.shift.closingDriftMinutes, "Closed")}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-admin-card-border p-4">
                <p className="mb-2 text-sm font-medium text-admin-header-text">
                  Production vs Sales
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-admin-muted">Production cost</span>
                    <span>{money(report.production.totalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-admin-muted">Sales</span>
                    <span>{money(report.production.totalSales)}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium">
                    <span>Variance</span>
                    <span>{money(report.production.variance)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-admin-muted">Margin</span>
                    <span>{report.production.profitMargin}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-admin-card-border p-4">
                <p className="mb-2 text-sm font-medium text-admin-header-text">Plate Movement</p>
                {report.plateMovement.length === 0 ? (
                  <p className="text-sm text-admin-muted">No snapshots recorded.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    <div className="grid grid-cols-[1fr_56px_56px_56px_56px] gap-x-3 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                      <span>Item</span>
                      <span className="text-right">Open</span>
                      <span className="text-right">Cooked</span>
                      <span className="text-right">Sold</span>
                      <span className="text-right">Close</span>
                    </div>
                    {report.plateMovement.map((row) => (
                      <div
                        key={row.menuId}
                        className="grid grid-cols-[1fr_56px_56px_56px_56px] items-center gap-x-3 border-t border-admin-card-border pt-1"
                      >
                        <span className="truncate">{row.menuName}</span>
                        <span className="text-right tabular-nums">{row.openingPlates}</span>
                        <span className="text-right tabular-nums">{row.platesCooked}</span>
                        <span className="text-right tabular-nums">{row.platesSold}</span>
                        <span
                          className={cn(
                            "text-right tabular-nums",
                            row.closingPlates !== row.expectedClosing && "font-medium text-amber-600",
                          )}
                        >
                          {row.closingPlates ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-row gap-2">
              <Button type="button" variant="outline" onClick={handlePreview}>
                <Eye />
                Preview
              </Button>
              <Button type="button" variant="outline" onClick={handlePrint} disabled={printing}>
                <Printer />
                {printing ? "Printing..." : "Print"}
              </Button>
              <Button type="button" onClick={handleDismiss}>
                Done
              </Button>
            </DialogFooter>

            {/* Preview Dialog */}
            <Dialog open={previewHtml !== null} onOpenChange={(open) => { if (!open) setPreviewHtml(null) }}>
              <DialogContent className="max-w-md print:max-w-none print:p-0">
                <DialogHeader className="print:hidden">
                  <DialogTitle>Shift Report Preview</DialogTitle>
                </DialogHeader>
                {previewHtml && (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0 print:h-auto"
                    style={{ height: "70vh" }}
                    title="Shift Report Preview"
                  />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ShiftCloseDialog
