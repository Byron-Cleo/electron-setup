import { useEffect, useState } from "react"
import { CalendarDays, FileText, Printer, ShieldX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getShiftReport, getVoidReport, listShifts } from "@/lib/api"
import ShiftReportView from "@/components/reports/ShiftReport"

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function Reports() {
  const [date, setDate] = useState(todayISO())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [voidWaiters, setVoidWaiters] = useState<VoidReportWaiter[]>([])
  const [loading, setLoading] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadShifts() {
      setLoading(true)
      setError(null)
      setShifts([])
      setSelectedId("")
      setReport(null)
      try {
        const data = await listShifts(date)
        if (cancelled) return
        setShifts(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load shifts")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadVoidReport() {
      setVoidError(null)
      setVoidWaiters([])
      try {
        const waiters = await getVoidReport(date)
        if (cancelled) return
        setVoidWaiters(waiters)
      } catch (err) {
        if (!cancelled) {
          setVoidError(err instanceof Error ? err.message : "Failed to load void analytics")
        }
      }
    }

    loadShifts()
    loadVoidReport()
    return () => {
      cancelled = true
    }
  }, [date])

  async function handleSelectShift(shiftId: string) {
    setSelectedId(shiftId)
    setReport(null)
    setError(null)
    try {
      const data = await getShiftReport(shiftId)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    }
  }

  const closedShifts = shifts.filter((s) => !s.isOpen)

  function shiftLabel(shift: Shift): string {
    const period = shift.type === "DAY" ? "Day" : "Night"
    const status = shift.isOpen ? " (open)" : ""
    return `${period} Shift — ${new Date(shift.openingTime).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}${status}`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-admin-header-text">Reports</h1>
        {report && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Export PDF
          </Button>
        )}
      </div>

      {/* Selector */}
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-admin-muted" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Select
            value={selectedId}
            onValueChange={handleSelectShift}
            disabled={closedShifts.length === 0 || loading}
          >
            <SelectTrigger className="w-64">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading shifts..."
                    : closedShifts.length === 0
                      ? "No closed shifts on this date"
                      : "Select a closed shift"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {closedShifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  {shiftLabel(shift)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {!error && !loading && !selectedId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <FileText className="h-8 w-8 text-admin-muted" />
            <p className="text-sm text-admin-muted">
              Pick a date and select a closed shift to view its report.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && selectedId && !report && (
        <Card>
          <CardContent className="p-6 text-sm text-admin-muted">Loading report...</CardContent>
        </Card>
      )}

      {report && <ShiftReportView report={report} />}

      {/* Void analytics (per selected date) */}
      {voidError ? (
        <Card className="print:hidden">
          <CardContent className="p-6 text-sm text-red-600">{voidError}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldX className="h-4 w-4 text-admin-muted" />
              Void Analytics — {date}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {voidWaiters.length === 0 ? (
              <p className="text-sm text-admin-muted">No orders recorded on this date.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-admin-card-border text-left text-xs uppercase tracking-wide text-admin-muted">
                    <th className="py-2 pr-2 font-semibold">Waiter</th>
                    <th className="py-2 px-2 text-right font-semibold">Total Orders</th>
                    <th className="py-2 px-2 text-right font-semibold">Voided</th>
                    <th className="py-2 px-2 text-right font-semibold">Replaced</th>
                    <th className="py-2 px-2 text-right font-semibold">Pending</th>
                    <th className="py-2 px-2 text-right font-semibold">Void Rate</th>
                    <th className="py-2 pl-2 font-semibold">Common Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {voidWaiters.map((w) => (
                    <tr key={w.waiterId} className="border-b border-admin-card-border last:border-b-0">
                      <td className="py-2 pr-2">{w.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{w.totalOrders}</td>
                      <td
                        className={
                          w.voidedOrders > 0
                            ? "px-2 py-2 text-right font-medium text-red-600 tabular-nums"
                            : "px-2 py-2 text-right tabular-nums"
                        }
                      >
                        {w.voidedOrders}
                      </td>
                      <td
                        className={
                          w.replacedVoids > 0
                            ? "px-2 py-2 text-right font-medium text-green-600 tabular-nums"
                            : "px-2 py-2 text-right tabular-nums"
                        }
                      >
                        {w.replacedVoids}
                      </td>
                      <td
                        className={
                          w.pendingVoids > 0
                            ? "px-2 py-2 text-right font-medium text-amber-600 tabular-nums"
                            : "px-2 py-2 text-right tabular-nums"
                        }
                      >
                        {w.pendingVoids}
                      </td>
                      <td
                        className={
                          w.voidedOrders > 0
                            ? "px-2 py-2 text-right font-medium text-red-600"
                            : "px-2 py-2 text-right"
                        }
                      >
                        {w.voidRate}
                      </td>
                      <td className="py-2 pl-2 text-admin-muted">
                        {w.commonReasons.length > 0 ? w.commonReasons.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Reports
