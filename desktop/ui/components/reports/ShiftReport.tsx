import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface Props {
  report: ShiftReport
}

function ShiftReportView({ report }: Props) {
  const { shift, plateMovement, revenue, production, summary } = report
  const revenueEntries = (
    Object.entries(revenue) as [string, ShiftRevenueEntry][]
  ).filter(([key]) => key !== "total")

  return (
    <div className="space-y-4">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-card-border text-left text-xs uppercase tracking-wide text-admin-muted">
                  <th className="py-2 pr-2 font-semibold">Item</th>
                  <th className="py-2 px-2 text-right font-semibold">Opening</th>
                  <th className="py-2 px-2 text-right font-semibold">Cooked</th>
                  <th className="py-2 px-2 text-right font-semibold">Sold</th>
                  <th className="py-2 px-2 text-right font-semibold">Expected</th>
                  <th className="py-2 px-2 text-right font-semibold">Actual Close</th>
                  <th className="py-2 pl-2 text-right font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody>
                {plateMovement.map((row) => (
                  <tr key={row.menuId} className="border-b border-admin-card-border last:border-b-0">
                    <td className="max-w-[200px] truncate py-2 pr-2">{row.menuName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.openingPlates}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.platesCooked}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.platesSold}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.expectedClosing}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.closingPlates ?? "—"}</td>
                    <td
                      className={cn(
                        "py-2 pl-2 text-right font-medium tabular-nums",
                        row.closingPlates === null
                          ? "text-admin-muted"
                          : row.variance !== 0
                            ? "text-red-600"
                            : "text-green-600",
                      )}
                    >
                      {row.closingPlates === null ? "—" : row.variance > 0 ? `+${row.variance}` : row.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShiftReportView
