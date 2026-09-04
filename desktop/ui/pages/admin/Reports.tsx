import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Printer, ShieldX, ClipboardList, Eye, AlertTriangle, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { DataTable } from "@/components/ui/data-table"
import BackButton from "@/components/shared/BackButton"
import ShiftCloseDialog from "@/components/shift/ShiftCloseDialog"
import ShiftReportView from "@/components/reports/ShiftReport"
import { getShiftReport, getVoidReport, listShiftsByRange, getShiftConfigs, getShift } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { cn } from "@/lib/utils"

type ActiveView = "shift-report" | "waiters-report" | null
type ShiftSubView = "types" | "list" | "detail"

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

function todayStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
}

function formatHm(hhmm: string | null | undefined): string {
  if (!hhmm) return "—"
  const [h, m] = hhmm.split(":")
  const hour = Number(h)
  if (Number.isNaN(hour)) return hhmm
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${m ?? "00"} ${period}`
}

function money(amount: number): string {
  return `KSH ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`
}

function shiftStatus(shift: Shift): { label: string; cls: string } {
  if (shift.isOpen && !shift.autoClosed) {
    return { label: "Live", cls: "bg-blue-100 text-blue-700" }
  }
  if (shift.isOpen && shift.autoClosed) {
    return { label: "Awaiting Manual Close", cls: "bg-amber-100 text-amber-700" }
  }
  if (shift.finalCloseSource === "AUTO") {
    return { label: "Closed (Auto)", cls: "bg-slate-100 text-slate-600" }
  }
  return { label: "Closed (Manual)", cls: "bg-green-100 text-green-700" }
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
  const user = useAuthStore((s) => s.user)
  const [subview, setSubview] = useState<ShiftSubView>("types")
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(null)
  const [shiftConfigs, setShiftConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [from, setFrom] = useState<Date | null>(() => {
    const d = todayStart()
    d.setDate(d.getDate() - 6)
    return d
  })
  const [to, setTo] = useState<Date | null>(() => todayStart())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [closeShift, setCloseShift] = useState<Shift | null>(null)
  const [closeShiftOpen, setCloseShiftOpen] = useState(false)

  useEffect(() => {
    getShiftConfigs().then(setShiftConfigs).catch(() => {})
  }, [])

  useEffect(() => {
    if (subview !== "list" || !selectedShiftType || !from || !to) {
      return
    }
    const shiftType = selectedShiftType
    const fromKey = dateKey(from)
    const toKey = dateKey(to)
    let cancelled = false

    async function loadShifts() {
      setLoading(true)
      setError(null)
      setReport(null)
      try {
        const data = await listShiftsByRange(shiftType, fromKey, toKey)
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

    loadShifts()
    return () => {
      cancelled = true
    }
  }, [subview, selectedShiftType, from, to])

  function resetToLast7Days() {
    const end = todayStart()
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    setTo(end)
    setFrom(start)
  }

  async function handleSelectShiftType(type: string) {
    setSelectedShiftType(type)
    resetToLast7Days()
    setSubview("list")
  }

  async function handleRowClick(shift: Shift) {
    setReport(null)
    setError(null)
    setSubview("detail")
    try {
      const data = await getShiftReport(shift.id)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    }
  }

  async function handleCloseClick(shift: Shift) {
    try {
      // ShiftCloseDialog wants a shift with its orders included.
      const full = await getShift(shift.id)
      setCloseShift(full)
      setCloseShiftOpen(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load shift")
    }
  }

  const shiftColumns = useMemo(
    () => [
      { label: "Date", key: "date", align: "left" as const },
      { label: "Open → Close", key: "window", align: "left" as const },
      { label: "Status", key: "status", align: "left" as const },
      { label: "Orders", key: "orders", align: "right" as const },
      { label: "Revenue", key: "revenue", align: "right" as const },
      { label: "Drift", key: "drift", align: "right" as const },
      { label: "Closed By", key: "closedBy", align: "left" as const },
      { label: "", key: "actions", isAction: true },
    ],
    [],
  )

  function renderShiftCell(shift: Shift, col: { key: string }) {
    const status = shiftStatus(shift)
    switch (col.key) {
      case "date":
        return <span className="font-medium text-admin-header-text">{formatDateKey(shift.operationDay)}</span>
      case "window":
        return (
          <span className="text-admin-muted">
            {formatTime(shift.autoOpenTime)} → {formatTime(shift.autoCloseTime)}
          </span>
        )
      case "status":
        return (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", status.cls)}>
            {shift.isOpen && shift.autoClosed && <AlertTriangle className="h-3 w-3" />}
            {status.label}
          </span>
        )
      case "orders":
        return <span className="tabular-nums">{shift.orderCount ?? shift.orders?.length ?? 0}</span>
      case "revenue":
        return <span className="tabular-nums font-medium">{money(shift.revenue ?? 0)}</span>
      case "drift":
        if (shift.driftMinutes === null || shift.driftMinutes === undefined) return <span className="text-admin-muted">—</span>
        return (
          <span className={cn("tabular-nums", shift.driftMinutes > 15 ? "text-amber-600 font-medium" : "text-admin-muted")}>
            {shift.driftMinutes > 0 ? `${shift.driftMinutes}m` : "On time"}
          </span>
        )
      case "closedBy":
        return <span className="text-admin-muted">{shift.finalClosedBy?.name ?? "—"}</span>
      case "actions":
        if (shift.isOpen && shift.autoClosed) {
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseClick(shift)
              }}
            >
              <Eye className="mr-1 h-3 w-3" />
              Review &amp; Close
            </Button>
          )
        }
        if (shift.isOpen) {
          return (
            <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
              <Eye className="h-3 w-3" /> Live
            </span>
          )
        }
        return null
      default:
        return null
    }
  }

  if (subview === "types") {
    return (
      <div className="space-y-4">
        <Heading as="h2" className="text-admin-header-text text-center text-xl">Select Shift Report</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
          {shiftConfigs.filter((c) => c.isActive).length === 0 && (
            <Card className="col-span-full border-red-500/30 bg-red-50/40 shadow-red-100/40">
              <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
                <Lock className="h-6 w-6 text-red-600" />
                <p className="text-sm font-semibold text-red-700">No shifts configured</p>
                <p className="text-xs text-red-600/80">Contact manager to configure shift schedules.</p>
              </CardContent>
            </Card>
          )}
          {shiftConfigs.filter((c) => c.isActive).map((c, idx) => (
            <Card key={c.id} className="p-6 text-center transition-colors cursor-pointer hover:border-admin-accent" onClick={() => handleSelectShiftType(c.type)}>
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

  if (subview === "detail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <BackButton onClick={() => { setSubview("list"); setReport(null) }} />
          {report && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print / Export PDF
            </Button>
          )}
        </div>

        {error && (
          <Card>
            <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
          </Card>
        )}

        {!error && !report && (
          <Card>
            <CardContent className="p-6 text-sm text-admin-muted">Loading report...</CardContent>
          </Card>
        )}

        {report && <ShiftReportView report={report} />}
      </div>
    )
  }

  const activeConfig = shiftConfigs.find((c) => c.type === selectedShiftType)
  const totalRevenue = shifts.reduce((sum, s) => sum + (s.revenue ?? 0), 0)
  const awaitingCount = shifts.filter((s) => s.isOpen && s.autoClosed).length
  const liveCount = shifts.filter((s) => s.isOpen && !s.autoClosed).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackButton onClick={() => { setSubview("types"); setSelectedShiftType(null); setShifts([]); setReport(null) }} />
        {report && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Export PDF
          </Button>
        )}
      </div>

      {/* Range picker bar */}
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            selectedShiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : selectedShiftType === "NIGHT" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700",
          )}>
            {selectedShiftType} Shift{activeConfig ? ` · ${formatHm(activeConfig.autoOpenTime)}–${formatHm(activeConfig.autoCloseTime)}` : ""}
          </span>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-admin-muted" />
            <DatePicker value={from} onChange={setFrom} placeholder="From" className="w-[150px]" />
            <span className="text-admin-muted">→</span>
            <DatePicker value={to} onChange={setTo} placeholder="To" className="w-[150px]" />
          </div>

          <Button variant="outline" size="sm" onClick={resetToLast7Days}>Last 7 days</Button>

          <div className="ml-auto flex items-center gap-2 text-xs">
            {liveCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" /> {liveCount} live
              </span>
            )}
            {awaitingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                <AlertTriangle className="mr-1 h-3 w-3" /> {awaitingCount} awaiting close
              </span>
            )}
            <span className="text-admin-muted">Revenue:</span>
            <span className="font-semibold tabular-nums text-admin-header-text">{money(totalRevenue)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Shift list */}
      <DataTable
        columns={shiftColumns}
        data={shifts}
        renderCell={renderShiftCell}
        onRowClick={handleRowClick}
        keyExtractor={(s) => s.id}
        emptyMessage={
          loading
            ? "Loading shifts..."
            : from && to
              ? `No ${selectedShiftType} shifts in ${dateKey(from)} – ${dateKey(to)}`
              : "Pick a range to view shifts."
        }
      />

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {/* Review & Close dialog */}
      {closeShift && user && (
        <ShiftCloseDialog
          shift={closeShift}
          finalClosedById={user.id}
          open={closeShiftOpen}
          onOpenChange={setCloseShiftOpen}
          onClosed={() => {
            setCloseShift(null)
            setCloseShiftOpen(false)
            resetToLast7Days()
          }}
        />
      )}
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
  const [date, setDate] = useState<Date | null>(todayStart())
  const [voidWaiters, setVoidWaiters] = useState<VoidReportWaiter[]>([])
  const [voidError, setVoidError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) return
    const dateKeyValue = dateKey(date)
    let cancelled = false

    async function loadVoidReport() {
      setLoading(true)
      setVoidError(null)
      setVoidWaiters([])
      try {
        const waiters = await getVoidReport(dateKeyValue)
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
            <DatePicker value={date} onChange={setDate} placeholder="Select date" />
          </div>
        </CardContent>
      </Card>

      {voidError ? (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-6 flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">No waiter report available</p>
            <p className="text-xs text-amber-700/80">
              No orders have been placed for the selected date yet, or the server could not be reached.
              Try a different date or check that the backend server is running.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={voidColumns}
          data={voidWaiters}
          renderCell={renderVoidCell}
          keyExtractor={(w) => w.waiterId}
          emptyMessage={loading ? "Loading report..." : "No orders recorded for this date. Waiter report will appear here once orders are placed."}
        />
      )}
    </div>
  )
}

export default Reports
