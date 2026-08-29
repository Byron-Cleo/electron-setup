import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Eye, Printer, AlertCircle, Wallet, Landmark, CheckCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  closeShift,
  getShiftReport,
  previewShiftReport,
  printShiftReport,
  markOrderAsUnpaid,
} from "@/lib/api"
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
  const [markingUnpaid, setMarkingUnpaid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [declaredCash, setDeclaredCash] = useState("")
  const [declaredMpesa, setDeclaredMpesa] = useState("")

  const stats = useMemo(() => {
    const orders = shift.orders ?? []
    const active = orders.filter((o) => !o.isVoid)
    const paid = active.filter((o) => o.isPaid)
    const unpaid = active.filter((o) => !o.isPaid)

    const cashTotal = paid
      .filter((o) => o.paymentMethod === "cash")
      .reduce((sum, o) => sum + Number(o.totalPrice), 0)
    const mpesaTotal = paid
      .filter((o) => o.paymentMethod === "mpesa")
      .reduce((sum, o) => sum + Number(o.totalPrice), 0)
    const unpaidTotal = unpaid.reduce((sum, o) => sum + Number(o.totalPrice), 0)
    const unpaidCount = unpaid.length
    const blockingUnpaid = unpaid.filter((o) => !o.unpaidAcknowledged)

    const cashOrders = paid.filter((o) => o.paymentMethod === "cash").length
    const mpesaOrders = paid.filter((o) => o.paymentMethod === "mpesa").length

    const revenueByMealType: Record<string, { orders: number; total: number }> = {}
    let revenue = 0
    for (const order of paid) {
      revenue += Number(order.totalPrice)
      const entry = (revenueByMealType[order.mealType] ??= { orders: 0, total: 0 })
      entry.orders += 1
      entry.total += Number(order.totalPrice)
    }
    return {
      totalOrders: shift.orders?.length ?? 0,
      voidedOrders: orders.length - active.length,
      unvoidedOrders: active.length,
      paidOrders: paid.length,
      unpaidOrders: unpaidCount,
      blockingUnpaidCount: blockingUnpaid.length,
      blockingUnpaid,
      cashTotal,
      mpesaTotal,
      unpaidTotal,
      revenue,
      revenueByMealType,
      cashOrders,
      mpesaOrders,
    }
  }, [shift])

  const enforceCloseTime = import.meta.env.VITE_ENFORCE_SHIFT_CLOSE_TIME === "true"
  const pastAutoClose = enforceCloseTime
    ? new Date() > new Date(shift.autoCloseTime)
    : true

  const canClose = pastAutoClose && stats.blockingUnpaidCount === 0

  async function handleMarkUnpaid(orderId: string) {
    setMarkingUnpaid(orderId)
    setError(null)
    try {
      await markOrderAsUnpaid(orderId, closedById)
      // Force re-render by toggling a key or let the parent refresh
      onClosed()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark order as unpaid")
    } finally {
      setMarkingUnpaid(null)
    }
  }

  async function handleCloseShift() {
    setClosing(true)
    setError(null)
    try {
      const cash = declaredCash ? Number(declaredCash) : undefined
      const mpesa = declaredMpesa ? Number(declaredMpesa) : undefined
      await closeShift(shift.id, closedById, cash, mpesa)
      const data = await getShiftReport(shift.id)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift")
    } finally {
      setClosing(false)
    }
  }

  function handleDismiss() {
    if (report) onClosed()
    onOpenChange(false)
    setTimeout(() => {
      setReport(null)
      setError(null)
      setClosing(false)
      setPreviewHtml(null)
      setDeclaredCash("")
      setDeclaredMpesa("")
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
      unassignedCarryOver: r.unassignedCarryOver,
      payments: r.payments,
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

  const p = report?.payments

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {!report ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Close {shift.type === "DAY" ? "Day" : "Night"} Shift
              </DialogTitle>
              <DialogDescription>
                Review payment summary, mark any unpaid orders as tracked, and declare cash/M-Pesa
                before locking the shift.
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

              {/* Payment Summary */}
              <Card className="p-4">
                <p className="mb-3 text-sm font-medium text-admin-header-text">Payment Summary (System)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> M-Pesa
                    </p>
                    <p className="text-lg font-bold text-green-700">{money(stats.mpesaTotal)}</p>
                    <p className="text-xs text-green-600">{stats.mpesaOrders} orders</p>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs text-orange-700 font-medium flex items-center gap-1">
                      <Landmark className="h-3 w-3" /> Cash
                    </p>
                    <p className="text-lg font-bold text-orange-700">{money(stats.cashTotal)}</p>
                    <p className="text-xs text-orange-600">{stats.cashOrders} orders</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Unpaid
                    </p>
                    <p className="text-lg font-bold text-amber-700">{money(stats.unpaidTotal)}</p>
                    <p className="text-xs text-amber-600">{stats.unpaidOrders} order{stats.unpaidOrders !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-admin-muted">
                  <span>Revenue (paid only)</span>
                  <span className="font-semibold">{money(stats.revenue)}</span>
                </div>
              </Card>

              {/* Unpaid Orders Blocking Close */}
              {stats.blockingUnpaidCount > 0 && (
                <Card className="p-4 border-amber-300 bg-amber-50">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">
                      {stats.blockingUnpaidCount} unpaid order{stats.blockingUnpaidCount !== 1 ? "s" : ""} must be marked as unpaid before closing.
                    </p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.blockingUnpaid.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50/50 p-2 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="font-medium">#{order.orderNumber}</div>
                          <div className="text-xs text-amber-700">{order.mealType}</div>
                          <div className="text-xs text-amber-700">{money(Number(order.totalPrice))}</div>
                          <div className="text-xs text-amber-600">{order.User?.name ?? "—"}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={markingUnpaid === order.id ? "default" : "outline"}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
                          onClick={() => handleMarkUnpaid(order.id)}
                          disabled={markingUnpaid !== null && markingUnpaid !== order.id}
                        >
                          {markingUnpaid === order.id ? (
                            <>
                              <Loader2 className="animate-spin mr-1 h-3 w-3" /> Marking...
                            </>
                          ) : (
                            <>
                              <CheckCheck className="mr-1 h-3 w-3" /> Mark Unpaid
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </Card>
              )}

              {/* Declared Amounts Inputs */}
              <Card className="p-4">
                <p className="mb-3 text-sm font-medium text-admin-header-text">Manager Declaration (Actual Received)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="declaredCash" className="text-xs text-orange-700 font-medium">
                      Actual Cash Received
                    </Label>
                    <Input
                      id="declaredCash"
                      type="number"
                      step="0.01"
                      min="0"
                      value={declaredCash}
                      onChange={(e) => setDeclaredCash(e.target.value)}
                      placeholder="e.g. 12500"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="declaredMpesa" className="text-xs text-green-700 font-medium">
                      Actual M-Pesa Received
                    </Label>
                    <Input
                      id="declaredMpesa"
                      type="number"
                      step="0.01"
                      min="0"
                      value={declaredMpesa}
                      onChange={(e) => setDeclaredMpesa(e.target.value)}
                      placeholder="e.g. 18000"
                      className="text-right"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-admin-muted">
                  Enter the actual cash and M-Pesa you have counted. Variances will be shown in the report.
                </p>
              </Card>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDismiss} disabled={closing}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCloseShift}
                  disabled={closing || !canClose}
                  title={
                    !pastAutoClose
                      ? "Shift can only be closed after its scheduled close time."
                      : stats.blockingUnpaidCount > 0
                      ? `${stats.blockingUnpaidCount} unpaid order(s) must be marked as unpaid first.`
                      : ""
                  }
                >
                  {closing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Closing...
                    </>
                  ) : pastAutoClose && canClose ? (
                    "Confirm Close"
                  ) : pastAutoClose ? (
                    `${stats.blockingUnpaidCount} unpaid order(s) blocking close`
                  ) : (
                    `Closes ${formatTime(shift.autoCloseTime)}`
                  )}
                </Button>
              </DialogFooter>
            </div>
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

              {/* Payment Reconciliation */}
              {p && (
                <Card className="p-4">
                  <p className="mb-3 text-sm font-medium text-admin-header-text">Payment Reconciliation</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> M-Pesa
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">System Total</span>
                          <span className="font-medium text-green-700">{money(p.mpesaTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">Declared</span>
                          <span className="font-medium text-green-700">
                            {p.declaredMpesa !== null ? money(p.declaredMpesa) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-green-200 pt-1">
                          <span className="font-medium text-green-600">Variance</span>
                          <span
                            className={`font-bold ${
                              p.mpesaVariance !== null && p.mpesaVariance < 0 ? "text-red-600" : "text-green-700"
                            }`}
                          >
                            {p.mpesaVariance !== null ? money(p.mpesaVariance) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <p className="text-xs text-orange-700 font-medium flex items-center gap-1">
                        <Landmark className="h-3 w-3" /> Cash
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-orange-600">System Total</span>
                          <span className="font-medium text-orange-700">{money(p.cashTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orange-600">Declared</span>
                          <span className="font-medium text-orange-700">
                            {p.declaredCash !== null ? money(p.declaredCash) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-orange-200 pt-1">
                          <span className="font-medium text-orange-600">Variance</span>
                          <span
                            className={`font-bold ${
                              p.cashVariance !== null && p.cashVariance < 0 ? "text-red-600" : "text-orange-700"
                            }`}
                          >
                            {p.cashVariance !== null ? money(p.cashVariance) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Unpaid
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-amber-600">Unpaid Orders</span>
                          <span className="font-medium text-amber-700">{p.unpaid.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-amber-600">Unpaid Total</span>
                          <span className="font-medium text-amber-700">{money(p.unpaid.total)}</span>
                        </div>
                        <div className="flex justify-between border-t border-amber-200 pt-1">
                          <span className="font-medium text-amber-600">System Revenue (Paid Only)</span>
                          <span className="font-bold text-amber-700">{money(p.cashTotal + p.mpesaTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

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
                      <span className="text-right">Open*</span>
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
                    {report.unassignedCarryOver && report.unassignedCarryOver.total > 0 && (
                      <div className="border-t border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-medium text-orange-700">
                        Total Unassigned Carry-Over: {report.unassignedCarryOver.total} plates
                      </div>
                    )}
                    <p className="pt-1 text-[10px] text-admin-muted">
                      * Opening = carry-forward closing stock from the previous shift.
                    </p>
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