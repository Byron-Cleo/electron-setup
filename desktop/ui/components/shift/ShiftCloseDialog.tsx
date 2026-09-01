import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Eye, Printer, AlertCircle, Wallet, Landmark, CheckCheck, ChevronLeft, ChevronRight, Search } from "lucide-react"
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  closeShift,
  getCurrentShift,
  getShiftReport,
  previewShiftReport,
  printShiftReport,
  markOrderAsUnpaid,
} from "@/lib/api"
import { cn } from "@/lib/utils"

function money(amount: number): string {
  return `KSH ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`
}

function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "")
  const [intPart, ...rest] = cleaned.split(".")
  const decimal = rest.length > 0 ? `.${rest.join("")}` : ""
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${grouped}${decimal}`
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
  finalClosedById: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: () => void
}

function ShiftCloseDialog({ shift, finalClosedById, open, onOpenChange, onClosed }: Props) {
  const [liveShift, setLiveShift] = useState<Shift>(shift)
  const [closing, setClosing] = useState(false)
  const [markingUnpaid, setMarkingUnpaid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [declaredCash, setDeclaredCash] = useState("")
  const [declaredMpesa, setDeclaredMpesa] = useState("")
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState("")

  const stats = useMemo(() => {
    const orders = liveShift.orders ?? []
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
      totalOrders: liveShift.orders?.length ?? 0,
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
  }, [liveShift])

  const filteredUnpaid = useMemo(() => {
    if (!search.trim()) return stats.blockingUnpaid
    const q = search.trim().toLowerCase()
    return stats.blockingUnpaid.filter((o) => {
      const numberMatch = String(o.orderNumber).includes(q)
      const mealMatch = o.mealType.toLowerCase().includes(q)
      const nameMatch = (o.User?.name ?? "").toLowerCase().includes(q)
      return numberMatch || mealMatch || nameMatch
    })
  }, [search, stats.blockingUnpaid])

  const totalSteps = 3

  const enforceCloseTime = import.meta.env.VITE_ENFORCE_SHIFT_CLOSE_TIME === "true"
  const pastAutoClose = enforceCloseTime
    ? new Date() > new Date(liveShift.autoCloseTime)
    : true

  const canClose = pastAutoClose && stats.blockingUnpaidCount === 0

  async function handleMarkUnpaid(orderId: string) {
    setMarkingUnpaid(orderId)
    setError(null)
    try {
      await markOrderAsUnpaid(orderId, finalClosedById)
      const fresh = await getCurrentShift()
      if (fresh) setLiveShift(fresh)
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
      const cash = declaredCash ? Number(declaredCash.replace(/,/g, "")) : undefined
      const mpesa = declaredMpesa ? Number(declaredMpesa.replace(/,/g, "")) : undefined
      await closeShift(liveShift.id, finalClosedById, cash, mpesa, [])
      const data = await getShiftReport(liveShift.id)
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
      setStep(1)
      setSearch("")
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
        operationDay: r.shift.operationDay,
        autoOpenTime: r.shift.autoOpenTime,
        autoCloseTime: r.shift.autoCloseTime,
        openingDriftMinutes: r.shift.openingDriftMinutes,
        closingDriftMinutes: r.shift.closingDriftMinutes,
        driftMinutes: r.shift.driftMinutes,
        finalClosedBy: r.shift.finalClosedBy?.name ?? "—",
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
                Close {liveShift.type === "DAY" ? "Day" : "Night"} Shift
                {liveShift.type === "DAY"
                  ? <span className="ml-2 text-2xl">🌅</span>
                  : <span className="ml-2 text-2xl">🌃</span>}
              </DialogTitle>
              <DialogDescription>
                Review payment summary, mark any unpaid orders as tracked, and declare cash/M-Pesa
                before locking the shift.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Step Indicator */}
              <div className="mx-auto flex max-w-md items-center gap-2">
                {[
                  { num: 1, label: "Payment" },
                  { num: 2, label: "Unpaid Orders" },
                  { num: 3, label: "Declaration" },
                ].map((s) => (
                  <div key={s.num} className="flex flex-1 items-center gap-1.5">
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        step > s.num
                          ? "bg-green-600 text-white"
                          : step === s.num
                          ? "bg-blue-600 text-white"
                          : "bg-admin-card-border text-admin-muted",
                      )}
                    >
                      {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                    </div>
                    <span
                      className={cn(
                        "hidden text-xs font-medium sm:block",
                        step === s.num ? "text-admin-header-text" : "text-admin-muted",
                      )}
                    >
                      {s.label}
                    </span>
                    {s.num < totalSteps && <div className="h-px flex-1 bg-admin-card-border" />}
                  </div>
                ))}
              </div>

              {pastAutoClose && (
                <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This shift is past its scheduled close time ({formatTime(liveShift.autoCloseTime)}
                    ). Closing now will record a drift against it.
                  </span>
                </div>
              )}

              {/* Step 1: Payment Summary */}
              {step === 1 && (
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
                  <div className="mt-3 flex items-center justify-between border-t border-admin-card-border pt-3 text-xs text-blue-700">
                    <span className="font-medium">Revenue (paid only)</span>
                    <span className="font-semibold">{money(stats.revenue)}</span>
                  </div>
                </Card>
              )}

              {/* Step 2: Unpaid Orders */}
              {step === 2 && (
                <Card className="p-4">
                  {stats.blockingUnpaidCount === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">No unpaid orders — you can proceed to close. <span className="text-xl">😊 💵 ❤️</span></span>
                    </div>
                  ) : (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-sm font-medium text-admin-header-text">
                        {stats.blockingUnpaidCount} unpaid order{stats.blockingUnpaidCount !== 1 ? "s" : ""} must be marked as unpaid before closing.
                      </p>
                    </div>
                  </div>
                  )}

                  {stats.blockingUnpaidCount > 0 && (
                    <>
                      <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search by order #, meal period, or customer..."
                          className="pl-8"
                        />
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredUnpaid.length === 0 ? (
                          <p className="py-4 text-center text-sm text-admin-muted">No unpaid orders match your search.</p>
                        ) : (
                          filteredUnpaid.slice(0, 5).map((order) => (
                            <div
                              key={order.id}
                              className="grid grid-cols-1 sm:grid-cols-[110px_1fr_1fr_1fr_auto] sm:items-center gap-2 sm:gap-3 rounded border border-red-300 bg-red-50/50 p-2 text-sm"
                            >
                              <div className="font-semibold text-red-900">#{order.orderNumber}</div>
                              <div className="text-red-800">{order.User?.name ?? "—"}</div>
                              <div className="text-red-800">{order.mealType}</div>
                              <div className="font-semibold text-red-900">{money(Number(order.totalPrice))}</div>
                              <Button
                                size="sm"
                                variant={markingUnpaid === order.id ? "default" : "outline"}
                                className="bg-red-600 text-white hover:bg-red-700 border-red-600"
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
                          ))
                        )}
                      </div>
                      {filteredUnpaid.length > 5 && (
                        <p className="mt-2 text-xs text-admin-muted">
                          Showing 5 of {filteredUnpaid.length}. Refine your search to see the rest.
                        </p>
                      )}
                    </>
                  )}

                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </Card>
              )}

              {/* Step 3: Manager Declaration */}
              {step === 3 && (
                <Card className="p-4">
                  <p className="mb-3 text-sm font-medium text-admin-header-text">Manager Declaration (Actual Received)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="declaredCash" className="text-xs text-orange-700 font-medium">
                        Actual Cash Received
                      </Label>
                      <Input
                        id="declaredCash"
                        type="text"
                        inputMode="decimal"
                        value={declaredCash}
                        onChange={(e) => setDeclaredCash(formatAmountInput(e.target.value))}
                        placeholder="e.g. 12,500"
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="declaredMpesa" className="text-xs text-green-700 font-medium">
                        Actual M-Pesa Received
                      </Label>
                      <Input
                        id="declaredMpesa"
                        type="text"
                        inputMode="decimal"
                        value={declaredMpesa}
                        onChange={(e) => setDeclaredMpesa(formatAmountInput(e.target.value))}
                        placeholder="e.g. 18,000"
                        className="text-right"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-admin-muted">
                    Enter the actual cash and M-Pesa you have counted. Variances will be shown in the report.
                  </p>
                </Card>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={closing}>
                      <ChevronLeft />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {step < totalSteps ? (
                    <Button
                      type="button"
                      onClick={() => setStep(step + 1)}
                      disabled={step === 2 && stats.blockingUnpaidCount > 0}
                      title={
                        step === 2 && stats.blockingUnpaidCount > 0
                          ? "Mark all unpaid orders before continuing."
                          : ""
                      }
                    >
                      Next
                      <ChevronRight />
                    </Button>
                  ) : (
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
                        `Closes ${formatTime(liveShift.autoCloseTime)}`
                      )}
                    </Button>
                  )}
                </div>
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
                {formatDate(report.shift.operationDay)} · opened {formatTime(report.shift.autoOpenTime)} ·
                closed {formatTime(report.shift.autoClosedAt ?? report.shift.autoCloseTime)} by{" "}
                {report.shift.finalClosedBy?.name ?? "—"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary Stats + Revenue by Meal Period */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue by Meal Period</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(report.revenue)
                      .filter(([k]) => k !== "total")
                      .map(([mealType, entry]) => {
                        const e = entry as { orders: number; total: number };
                        return (
                          <div key={mealType} className="flex justify-between text-sm">
                            <span className="text-admin-muted">{mealType} ({e.orders})</span>
                            <span className="font-medium">{money(e.total)}</span>
                          </div>
                        );
                      })}
                    <div className="border-t border-admin-card-border pt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{money(report.revenue.total)}</span>
                    </div>
                  </CardContent>
                </Card>
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
                  <div>{formatTime(report.shift.autoOpenTime)}</div>
                  <div className="text-admin-muted">Actual open time</div>
                  <div>{formatTime(report.shift.autoOpenTime)}</div>
                  <div className="text-admin-muted">Opening drift</div>
                  <div className={cn(report.shift.openingDriftMinutes !== 0 && "text-amber-600")}>
                    {driftLabel(report.shift.openingDriftMinutes, "Opened")}
                  </div>

                  <div className="col-span-2 border-t border-admin-card-border" />

                  <div className="text-admin-muted">Defined close time</div>
                  <div>{formatTime(report.shift.autoCloseTime)}</div>
                  <div className="text-admin-muted">Actual close time</div>
                  <div>{formatTime(report.shift.autoClosedAt ?? report.shift.autoCloseTime)}</div>
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
                    <p className="pt-1 text-center text-[10px] leading-snug text-admin-muted">
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