import { useEffect, useState } from "react"
import { CalendarDays, FileText, Printer, ShieldX, ClipboardList } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import BackButton from "@/components/shared/BackButton"
import { getShiftReport, getVoidReport, listShifts, getShiftConfigs } from "@/lib/api"
import ShiftReportView from "@/components/reports/ShiftReport"

type ActiveView = "shift-report" | "waiters-report" | null
type ShiftReportViewState = "shift-selection" | "report-view"

const cards: {
  title: string
  description: string
  icon: typeof ClipboardList
  view: NonNullable<ActiveView>
}[] = [
  {
    title: "Shift Report",
    description: "View revenue, plate movement and production for a closed shift",
    icon: ClipboardList,
    view: "shift-report",
  },
  {
    title: "Waiters Report",
    description: "Void analytics per waiter for a selected date",
    icon: ShieldX,
    view: "waiters-report",
  },
]

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function Reports() {
  const [activeView, setActiveView] = useState<ActiveView>(null)

  return (
    <div>
      <Heading as="h1" className="mb-4 text-admin-header-text">Reports</Heading>

      {!activeView && (
        <div className="grid grid-cols-2 gap-6">
          {cards.map((card) => (
            <Card
              key={card.view}
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setActiveView(card.view)}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <card.icon size={24} className="text-green-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">{card.title}</Heading>
                  <p className="text-sm text-admin-muted mt-1">{card.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeView && (
        <div className="space-y-4">
          {activeView === "shift-report" && (
            <ShiftReportSection />
          )}
          {activeView === "waiters-report" && (
            <>
              <BackButton onClick={() => setActiveView(null)} />
              <Heading as="h2" className="text-admin-header-text text-center">Waiters Report</Heading>
              <WaitersReportSection />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ShiftReportSection() {
  const [viewState, setViewState] = useState<ShiftReportViewState>("shift-selection")
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftConfigs, setShiftConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getShiftConfigs().then(setShiftConfigs).catch(() => {})
  }, [])

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

    if (viewState === "report-view" && selectedShiftType) {
      loadShifts()
    }
    return () => {
      cancelled = true
    }
  }, [date, viewState, selectedShiftType])

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

  const closedShifts = shifts.filter((s) => !s.isOpen && s.type === selectedShiftType)

  function shiftLabel(shift: Shift): string {
    const status = shift.isOpen ? " (open)" : ""
    return `${shift.type} Shift — ${new Date(shift.autoOpenTime).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}${status}`
  }

  if (viewState === "shift-selection") {
    return (
      <div className="space-y-4">
        <Heading as="h2" className="text-admin-header-text text-center text-xl">Select Shift Report</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
          {shiftConfigs.filter((c) => c.isActive).map((c, idx) => (
            <Card key={c.id} className="p-6 text-center transition-colors cursor-pointer hover:border-admin-accent" onClick={() => { setSelectedShiftType(c.type); setViewState("report-view"); }}>
              <div className={`h-16 w-16 rounded-lg flex items-center justify-center mx-auto mb-4 ${idx === 0 ? "bg-yellow-500/10" : idx === 1 ? "bg-indigo-500/10" : "bg-blue-500/10"}`}>
                <ClipboardList size={32} className={idx === 0 ? "text-yellow-600" : idx === 1 ? "text-indigo-600" : "text-blue-600"} />
              </div>
              <Heading as="h3" className="text-lg text-admin-header-text mb-2">{c.type} Shift Report</Heading>
              <p className="text-sm text-admin-muted">View {c.type.toLowerCase()} shift report ({new Date("1970-01-01T" + c.autoOpenTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()} — {new Date("1970-01-01T" + c.autoCloseTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()})</p>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackButton onClick={() => { setViewState("shift-selection"); setSelectedShiftType(null); setReport(null); }} />
        {report && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Export PDF
          </Button>
        )}
      </div>

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
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
            selectedShiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : selectedShiftType === "NIGHT" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
          }`}>
            {selectedShiftType} Shift
          </span>
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
    </div>
  )
}

const voidColumns = [
  { label: "Waiter", key: "name", align: "left" as const },
  { label: "Total Orders", key: "totalOrders", align: "right" as const },
  { label: "Voided", key: "voidedOrders", align: "right" as const },
  { label: "Replaced", key: "replacedVoids", align: "right" as const },
  { label: "Pending", key: "pendingVoids", align: "right" as const },
  { label: "Void Rate", key: "voidRate", align: "right" as const },
  { label: "Common Reasons", key: "commonReasons", align: "left" as const },
]

function WaitersReportSection() {
  const [date, setDate] = useState(todayISO())
  const [voidWaiters, setVoidWaiters] = useState<VoidReportWaiter[]>([])
  const [voidError, setVoidError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadVoidReport() {
      setLoading(true)
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
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadVoidReport()
    return () => {
      cancelled = true
    }
  }, [date])

  function renderVoidCell(w: VoidReportWaiter, col: { key: string }) {
    switch (col.key) {
      case "name":
        return <span>{w.name}</span>
      case "totalOrders":
        return <span className="tabular-nums">{w.totalOrders}</span>
      case "voidedOrders":
        return (
          <span className={w.voidedOrders > 0 ? "font-medium text-red-600 tabular-nums" : "tabular-nums"}>
            {w.voidedOrders}
          </span>
        )
      case "replacedVoids":
        return (
          <span className={w.replacedVoids > 0 ? "font-medium text-green-600 tabular-nums" : "tabular-nums"}>
            {w.replacedVoids}
          </span>
        )
      case "pendingVoids":
        return (
          <span className={w.pendingVoids > 0 ? "font-medium text-amber-600 tabular-nums" : "tabular-nums"}>
            {w.pendingVoids}
          </span>
        )
      case "voidRate":
        return (
          <span className={w.voidedOrders > 0 ? "font-medium text-red-600" : ""}>
            {w.voidRate}
          </span>
        )
      case "commonReasons":
        return <span className="text-admin-muted">{w.commonReasons.length > 0 ? w.commonReasons.join(", ") : "—"}</span>
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Export PDF
        </Button>
      </div>

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
        </CardContent>
      </Card>

      {voidError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">{voidError}</CardContent>
        </Card>
      ) : (
        <DataTable
          columns={voidColumns}
          data={voidWaiters}
          renderCell={renderVoidCell}
          keyExtractor={(w) => w.waiterId}
          emptyMessage={loading ? "Loading report..." : "No orders recorded on this date."}
        />
      )}
    </div>
  )
}

export default Reports