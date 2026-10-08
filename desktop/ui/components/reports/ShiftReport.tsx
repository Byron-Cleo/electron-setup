import { useState } from "react"
import { AlertTriangle, CheckCircle2, Coffee, Eye, Landmark, AlertCircle, MoonStar, Printer, Sparkles, UtensilsCrossed, Wallet, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { previewShiftReport, printShiftReport } from "@/lib/api"

function money(amount: number): string {
  return `KSH ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`
}

// 12-hour format with an explicit AM/PM marker so every timing in the
// report reads like "5:44 AM" — orders capture span, configured times,
// and the actual & drift times.
function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
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

function formatDriftMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—"
  const total = Math.abs(minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`
  if (hours > 0) return `${hours}h`
  return `${mins}min`
}

// Meal-period pills for Revenue by Meal Period, mirroring the Payment
// Reconciliation card designs: Breakfast = green (M-Pesa), Lunch = orange
// (Cash), Dinner = red; any other period falls back to the neutral blue pill.
function mealPeriodPill(mealType: string): {
  name: string
  border: string
  bg: string
  strong: string
  soft: string
  icon: LucideIcon
} {
  const key = mealType.toUpperCase()
  const name = key.charAt(0) + key.slice(1).toLowerCase()
  switch (key) {
    case "BREAKFAST":
      return { name, border: "border-green-200", bg: "bg-green-50", strong: "text-green-700", soft: "text-green-600", icon: Coffee }
    case "LUNCH":
      return { name, border: "border-orange-200", bg: "bg-orange-50", strong: "text-orange-700", soft: "text-orange-600", icon: UtensilsCrossed }
    case "DINNER":
      return { name, border: "border-red-200", bg: "bg-red-50", strong: "text-red-700", soft: "text-red-600", icon: MoonStar }
    default:
      return { name, border: "border-blue-200", bg: "bg-blue-50", strong: "text-blue-700", soft: "text-blue-600", icon: Sparkles }
  }
}

function buildShiftReportData(report: ShiftReport): ShiftReportData {
  return {
    restaurant: {
      name: "ERAEVA RESTAURANT",
      branch: "Airport",
      address: "Nairobi",
      poweredBy: "Apydy Technologies",
      tel: "0701315250",
    },
    shift: {
      type: report.shift.type,
      operationDay: report.shift.operationDay,
      autoOpenTime: report.shift.autoOpenTime,
      autoCloseTime: report.shift.autoCloseTime,
      openingDriftMinutes: report.shift.openingDriftMinutes,
      closingDriftMinutes: report.shift.closingDriftMinutes,
      driftMinutes: report.shift.driftMinutes,
      finalClosedBy: report.shift.finalClosedBy?.name ?? "—",
    },
    summary: report.summary,
    revenue: report.revenue,
    plateMovement: report.plateMovement,
    production: report.production,
    unassignedCarryOver: report.unassignedCarryOver,
    unassignedOutgoing: report.unassignedOutgoing,
    payments: report.payments,
  }
}

interface Props {
  report: ShiftReport
}

function ShiftReportView({ report }: Props) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const { shift, plateMovement, revenue, production, summary, payments } = report
  const revenueEntries = (
    Object.entries(revenue) as [string, ShiftRevenueEntry][]
  ).filter(([key]) => key !== "total")

  async function handlePreview() {
    try {
      const html = await previewShiftReport(buildShiftReportData(report))
      setPreviewHtml(html)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate preview")
    }
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const result = await printShiftReport(buildShiftReportData(report))
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handlePreview}>
          <Eye />
          Preview Report
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing}>
          <Printer />
          {printing ? "Printing..." : "Print Report"}
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-admin-muted">Orders</p>
            <p className="text-2xl font-bold text-admin-header-text">{summary.totalOrders}</p>
            {summary.firstOrderAt && summary.lastOrderAt && (
              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-orange-600">
                Orders Between {formatTime(summary.firstOrderAt)} — {formatTime(summary.lastOrderAt)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-admin-muted">Voided</p>
            <p
              className={cn(
                "text-2xl font-bold",
                summary.voidedOrders > 0 ? "text-red-600" : "text-admin-header-text",
              )}
            >
              {summary.voidedOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-admin-muted">Revenue</p>
            <p className="text-2xl font-bold text-admin-header-text">{money(revenue.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-admin-muted">Drift</p>
            <p
              className={cn(
                "flex items-center gap-1.5 text-lg font-bold",
                shift.driftMinutes > 15 ? "text-amber-600" : "text-green-600",
              )}
            >
              {shift.driftMinutes > 15 && <AlertTriangle className="h-4 w-4" />}
              {shift.isOpen ? "Open" : shift.driftMinutes > 0 ? `${shift.driftMinutes}m late` : "On time"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shift metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shift Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm">
            <span className="text-admin-muted">Period: </span>
            <span className="font-medium">
              {shift.type === "DAY" ? "Day" : "Night"} shift · {formatDate(shift.operationDay)} · opened by{" "}
              <span className="font-bold text-red-600">SYSTEM</span>
            </span>
            {report.shift.isOpen && (
              <span
                className={cn(
                  "ml-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  report.shift.autoClosed
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700",
                )}
              >
                {report.shift.autoClosed ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />
                )}
                {report.shift.autoClosed ? "Awaiting Manual Close" : "Live"}
              </span>
            )}
            {report.shift.finalCloseSource === "FORCED" && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                System Closed — drift limit reached
              </span>
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-admin-card-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                Configured
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Open time</span>
                  <span className="font-medium">{formatTime(shift.autoOpenTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Close time</span>
                  <span className="font-medium">{formatTime(shift.autoCloseTime)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-admin-card-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                Actual &amp; Drift
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Open time</span>
                  <span className="font-medium">{formatTime(shift.autoOpenTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Opening drift</span>
                  <span
                    className={cn(
                      "font-medium",
                      shift.openingDriftMinutes !== 0 && "text-amber-600",
                    )}
                  >
                    {driftLabel(shift.openingDriftMinutes, "Opened")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Close time</span>
                  <span className="font-medium">{formatTime(shift.finalClosedAt ?? shift.autoClosedAt ?? shift.autoCloseTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Closing drift</span>
                  <span
                    className={cn(
                      "font-medium",
                      shift.closingDriftMinutes !== 0 && "text-amber-600",
                    )}
                  >
                    {driftLabel(shift.closingDriftMinutes, "Closed")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue by meal period */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Meal Period</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueEntries.length === 0 ? (
              <p className="text-sm text-admin-muted">No revenue recorded for this shift.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3">
                  {revenueEntries.map(([mealType, entry]) => {
                    const pill = mealPeriodPill(mealType)
                    const Icon = pill.icon
                    return (
                      <div
                        key={mealType}
                        className={cn("flex items-center justify-between gap-2 rounded-lg border p-3 text-sm", pill.border, pill.bg)}
                      >
                        <span className={cn("flex min-w-0 items-center gap-1.5 font-medium", pill.strong)}>
                          <Icon className="h-3.5 w-3.5 shrink-0" /> {pill.name}
                          <span className={cn("whitespace-nowrap text-xs font-normal", pill.soft)}>
                            ({entry.orders} {entry.orders === 1 ? "order" : "orders"})
                          </span>
                        </span>
                        <span className={cn("shrink-0 font-bold", pill.strong)}>{money(entry.total)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{money(revenue.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Production vs Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Production vs Sales <span className="text-sm font-bold text-red-600">(Projection not yet implemented)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between border-b border-admin-card-border py-1">
                <span className="text-admin-muted">Production cost</span>
                <span>{money(production.totalCost)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-admin-card-border py-1">
                <span className="text-admin-muted">Sales</span>
                <span>{money(production.totalSales)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-admin-card-border py-1">
                <span className="font-medium">Variance</span>
                <span
                  className={cn(
                    "font-medium",
                    production.variance < 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {money(production.variance)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-admin-muted">Profit margin</span>
                <span className="flex items-center gap-1.5">
                  {production.profitMargin}
                  {production.variance >= 0 && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Reconciliation */}
      {payments && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Reconciliation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-700 font-medium flex items-center gap-1 mb-2">
                <Wallet className="h-3 w-3" /> M-Pesa
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-xs text-green-600">Direct M-Pesa Amount:</span>
                  <span className="font-medium text-green-700">{money(payments.mpesaDirect)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-green-600">From M-Pesa + Cash Orders' Amount:</span>
                  <span className="font-medium text-green-700">{money(payments.mpesaFromPartial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-green-600">Manager Declared Amount:</span>
                  <span className="font-medium text-green-700">
                    {payments.declaredMpesa !== null ? money(payments.declaredMpesa) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-green-600">Total M-Pesa</span>
                  <span className="font-bold text-green-700">{money(payments.mpesaTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-green-200 pt-1">
                  <span className="font-medium text-green-600">Variance</span>
                  <span className={`font-bold ${payments.mpesaVariance !== null && payments.mpesaVariance < 0 ? "text-red-600" : "text-green-700"}`}>
                    {payments.mpesaVariance !== null ? money(payments.mpesaVariance) : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs text-orange-700 font-medium flex items-center gap-1 mb-2">
                <Landmark className="h-3 w-3" /> Cash
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-xs text-orange-600">Direct Cash Amount:</span>
                  <span className="font-medium text-orange-700">{money(payments.cashDirect)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-orange-600">From M-Pesa + Cash Orders' Amount:</span>
                  <span className="font-medium text-orange-700">{money(payments.cashFromPartial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-orange-600">Manager Declared Amount:</span>
                  <span className="font-medium text-orange-700">
                    {payments.declaredCash !== null ? money(payments.declaredCash) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-orange-600">Total Cash</span>
                  <span className="font-bold text-orange-700">{money(payments.cashTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-orange-200 pt-1">
                  <span className="font-medium text-orange-600">Variance</span>
                  <span className={`font-bold ${payments.cashVariance !== null && payments.cashVariance < 0 ? "text-red-600" : "text-orange-700"}`}>
                    {payments.cashVariance !== null ? money(payments.cashVariance) : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs text-violet-700 font-medium flex items-center gap-1 mb-2">
                <Wallet className="h-3 w-3" /> M-Pesa + Cash
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-xs text-violet-600">Total Orders:</span>
                  <span className="font-medium text-violet-700">{payments.partial.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-violet-600">M-Pesa Portion Amount:</span>
                  <span className="font-medium text-green-700">{money(payments.partial.mpesaTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-violet-600">Cash Portion Amount:</span>
                  <span className="font-medium text-orange-700">{money(payments.partial.cashTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-violet-200 pt-1">
                  <span className="font-bold text-violet-600">Total Partial Amount:</span>
                  <span className="font-bold text-violet-700">{money(payments.partial.total)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1 mb-2">
                <AlertCircle className="h-3 w-3" /> Unpaid
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-600">Unpaid Orders</span>
                  <span className="font-medium text-amber-700">{payments.unpaid.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600">Unpaid Total Amount:</span>
                  <span className="font-medium text-amber-700">{money(payments.unpaid.total)}</span>
                </div>
                <div className="flex justify-between border-t border-amber-200 pt-1">
                  <span className="font-medium text-amber-600">System Revenue (Paid Only)</span>
                  <span className="font-bold text-amber-700">{money(payments.cashTotal + payments.mpesaTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plate movement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Plate Movement</CardTitle>
        </CardHeader>
        <CardContent>
          {plateMovement.length === 0 ? (
            <p className="text-sm text-admin-muted">No snapshots recorded.</p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="mx-auto w-auto text-xs">
                  <thead>
                    <tr className="border-b border-admin-card-border text-admin-muted">
                      <th className="px-3 py-2 text-center font-medium">Item</th>
                      <th className="px-3 py-2 text-center font-medium bg-yellow-100 text-yellow-900">Opening</th>
                      <th className="px-3 py-2 text-center font-medium">Cooked</th>
                        <th className="px-3 py-2 text-center font-medium bg-red-100 text-red-900" title="Plates sold before the auto-close tick">Sold</th>
                        <th className="px-3 py-2 text-center font-medium bg-green-100 text-green-900" title="opening + cooked − sold before auto-close">Closing Stock</th>
                      <th className="px-3 py-2 text-center font-medium bg-orange-100 text-orange-900">Drift Minutes</th>
                        <th className="px-3 py-2 text-center font-medium bg-red-100 text-red-900" title="plates sold after auto-close">Drift Sold<br />Count</th>
                      <th className="px-3 py-2 text-center font-medium">Wasted</th>
                      <th className="px-3 py-2 text-center font-medium bg-[oklch(0.962_0.044_255.585)] text-blue-900" title="Final closing stock">Final Closing Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plateMovement.map((row) => (
                      <tr
                        key={row.menuId}
                        className="border-b border-admin-card-border last:border-0"
                      >
                        <td className="px-3 py-2 text-center text-sm font-bold text-admin-header-text">{row.menuName}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-yellow-100">{row.openingPlates}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums">{row.platesCooked}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-red-100 text-red-900">{row.platesSoldAtAutoClose ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-green-100">{row.closingStockAtAutoClose ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-orange-100">{formatDriftMinutes(row.driftMinutes)}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums bg-red-100 text-red-900">{row.driftSold ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums">{row.platesWasted}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-center text-sm font-semibold tabular-nums bg-[oklch(0.962_0.044_255.585)]",
                            row.isLiveCurrent && "text-blue-600",
                          )}
                        >
                          {row.isLiveCurrent ? `${row.closingStockAtManualClose ?? "—"}*` : (row.closingStockAtManualClose ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plateMovement.some((r) => r.isLiveCurrent) && (
                  <p className="pt-2 text-[10px] text-admin-muted">* Live shift — current menu stock (no final close yet).</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <div className="text-sm font-semibold text-orange-700">
                    Unassigned Carry-Over (In): {report.unassignedCarryOver?.total ?? 0} plates
                  </div>
                  <p className="text-[11px] text-admin-muted">Brought in from the previous shift</p>
                  <div className="mt-2 space-y-1">
                    {(report.unassignedCarryOver?.batches ?? []).map((b, i) => (
                      <div key={`${b.stockSupplyName}-${i}`} className="text-xs text-admin-muted">
                        {b.stockSupplyName}: {b.unassigned} of {b.totalProduced} produced still
                        unassigned
                      </div>
                    ))}
                    {(report.unassignedCarryOver?.batches ?? []).length === 0 && (
                      <div className="text-xs text-admin-muted">None</div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-sm font-semibold text-blue-700">
                    Unassigned Carry-Forward (Out): {report.unassignedOutgoing?.total ?? 0} plates
                  </div>
                  <p className="text-[11px] text-admin-muted">Handed to the next shift</p>
                  <div className="mt-2 space-y-1">
                    {(report.unassignedOutgoing?.batches ?? []).map((b, i) => (
                      <div key={`${b.stockSupplyName}-${i}`} className="text-xs text-admin-muted">
                        {b.stockSupplyName}: {b.unassigned} of {b.totalProduced} produced still
                        unassigned
                      </div>
                    ))}
                    {(report.unassignedOutgoing?.batches ?? []).length === 0 && (
                      <div className="text-xs text-admin-muted">None</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}

export default ShiftReportView
