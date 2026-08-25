import { useState } from "react"
import { AlertTriangle, CheckCircle2, Eye, Printer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { previewShiftReport, printShiftReport } from "@/lib/api"

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
      date: report.shift.date,
      openingTime: report.shift.openingTime,
      autoCloseTime: report.shift.autoCloseTime,
      actualCloseTime: report.shift.actualCloseTime,
      openedBy: report.shift.openedBy?.name ?? "—",
      closedBy: report.shift.closedBy?.name,
    },
    summary: report.summary,
    revenue: report.revenue,
    plateMovement: report.plateMovement,
    production: report.production,
  }
}

interface Props {
  report: ShiftReport
}

function ShiftReportView({ report }: Props) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const { shift, plateMovement, revenue, production, summary } = report
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div className="text-admin-muted">Period</div>
            <div className="font-medium sm:col-span-2">
              {shift.type === "DAY" ? "Day" : "Night"} shift · {formatDate(shift.date)}
            </div>
            <div className="text-admin-muted">Opened</div>
            <div className="font-medium sm:col-span-2">
              {formatTime(shift.openingTime)} by {shift.openedBy?.name ?? "—"}
            </div>
            <div className="text-admin-muted">Scheduled close</div>
            <div className="font-medium sm:col-span-2">{formatTime(shift.autoCloseTime)}</div>
            <div className="text-admin-muted">Actually closed</div>
            <div className="font-medium sm:col-span-2">
              {shift.actualCloseTime
                ? `${formatTime(shift.actualCloseTime)} by ${shift.closedBy?.name ?? "—"}`
                : "—"}
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
              <div className="space-y-1 text-sm">
                {revenueEntries.map(([mealType, entry]) => (
                  <div key={mealType} className="flex items-center justify-between border-b border-admin-card-border py-1 last:border-b-0">
                    <span className="text-admin-muted">
                      {mealType} ({entry.orders} {entry.orders === 1 ? "order" : "orders"})
                    </span>
                    <span className="font-medium">{money(entry.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 text-sm font-semibold">
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
            <CardTitle className="text-base">Production vs Sales</CardTitle>
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
              {plateMovement.map((row) => (
                <div
                  key={row.menuId}
                  className="rounded-lg border border-admin-card-border p-3"
                >
                  <div className="mb-2 text-base font-bold text-admin-header-text">{row.menuName}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                    <div>
                      <span className="text-admin-muted">Opening</span>
                      <p className="text-sm font-semibold tabular-nums">{row.openingPlates}</p>
                    </div>
                    <div>
                      <span className="text-admin-muted">Cooked</span>
                      <p className="text-sm font-semibold tabular-nums">{row.platesCooked}</p>
                    </div>
                    <div>
                      <span className="text-admin-muted">Sold</span>
                      <p className="text-sm font-semibold tabular-nums">{row.platesSold}</p>
                    </div>
                    <div>
                      <span className="text-admin-muted">Expected</span>
                      <p className="text-sm font-semibold tabular-nums">{row.expectedClosing}</p>
                    </div>
                    <div>
                      <span className="text-admin-muted">Actual Close</span>
                      <p className="text-sm font-semibold tabular-nums">{row.closingPlates ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-admin-muted">Variance</span>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          row.closingPlates === null
                            ? "text-admin-muted"
                            : row.variance !== 0
                              ? "text-red-600"
                              : "text-green-600",
                        )}
                      >
                        {row.closingPlates === null ? "—" : row.variance > 0 ? `+${row.variance}` : row.variance}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
