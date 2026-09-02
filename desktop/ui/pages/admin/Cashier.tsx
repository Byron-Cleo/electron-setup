import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Eye, Ban, Receipt, XCircle, Wallet, ArrowRight, ArrowLeft, Banknote, Landmark, Lock } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getOrders, voidOrder, updateOrderPayment, listShifts, getCurrentShift, getShiftConfigs } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { usePagination } from "@/hooks/usePagination"
import BackButton from "@/components/shared/BackButton"
import CurrentShiftIndicator from "@/components/shared/CurrentShiftIndicator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"

function money(amount: number): string {
  return `KSH ${amount.toLocaleString("en-KE")}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString("en-KE", { dateStyle: "short" })
  const hour = d.getHours()
  const minute = String(d.getMinutes()).padStart(2, "0")
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? "AM" : "PM"
  return `${datePart}, ${hour12}:${minute} ${suffix}`
}

function opDayLabel(iso?: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function StatusBadge({ isPaid }: { isPaid: boolean }) {
  return isPaid ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      Paid
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
      Unpaid
    </span>
  )
}

type CashierView = "dashboard" | "orders-entry" | "orders" | "payment-entry" | "payment" | "void-entry" | "void"

type OrderTab = "ALL" | "MPESA" | "CASH" | "VOID" | "UNPAID" | "MARKED_UNPAID" | "BATCH"

const TAB_LABELS: Record<OrderTab, string> = {
  ALL: "All",
  MPESA: "M-Pesa",
  CASH: "Cash",
  VOID: "Void",
  UNPAID: "New Unpaid",
  MARKED_UNPAID: "Marked Unpaid",
  BATCH: "Batch",
}

const TAB_COLORS: Record<OrderTab, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-admin-accent text-admin-accent-text",
    inactive: "text-admin-muted hover:text-admin-header-text",
  },
  MPESA: {
    active: "bg-blue-100 text-blue-700",
    inactive: "text-blue-400 hover:text-blue-600",
  },
  CASH: {
    active: "bg-orange-100 text-orange-700",
    inactive: "text-orange-400 hover:text-orange-600",
  },
  VOID: {
    active: "bg-red-100 text-red-700",
    inactive: "text-red-400 hover:text-red-600",
  },
  UNPAID: {
    active: "bg-green-100 text-green-700",
    inactive: "text-green-400 hover:text-green-600",
  },
  BATCH: {
    active: "bg-purple-100 text-purple-700",
    inactive: "text-purple-400 hover:text-purple-600",
  },
  MARKED_UNPAID: {
    active: "bg-red-100 text-red-700",
    inactive: "text-red-400 hover:text-red-600",
  },
}

const ORDER_COLUMNS: Column[] = [
  { label: "Order #", key: "orderNumber", align: "center" },
  { label: "Meal", key: "mealType" },
  { label: "Payment", key: "paymentMethod", align: "center" },
  { label: "Total", key: "totalPrice", align: "center" },
  { label: "Status", key: "status" },
  { label: "Date", key: "createdAt" },
  { label: "Details", key: "details", isAction: true, align: "center" },
]

function Cashier() {
  const [view, setView] = useState<CashierView>("dashboard")
  const [selectedstring, setSelectedstring] = useState<string | undefined>()
  const [selectedPaymentstring, setSelectedPaymentstring] = useState<string | undefined>()
  const [selectedVoidstring, setSelectedVoidstring] = useState<string | undefined>()
  const [selectedOperationDay, setSelectedOperationDay] = useState<string | undefined>()
  const [currentstring, setCurrentstring] = useState<string | undefined>()
  const user = useAuthStore((s) => s.user)
  const isCashier = user?.role === "cashier"

  useEffect(() => {
    let cancelled = false
    getCurrentShift()
      .then((shift) => {
        if (!cancelled) setCurrentstring(shift?.type)
      })
      .catch(() => {
        if (!cancelled) setCurrentstring(undefined)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-2">
      <Heading as="h1" className="text-admin-header-text">
        Cashier
      </Heading>

      <CurrentShiftIndicator roles={["cashier"]} />

      {view !== "dashboard" && (
        <BackButton onClick={() => {
          if (view === "orders") {
            setView("orders-entry")
          } else if (view === "payment") {
            setView("payment-entry")
          } else if (view === "void") {
            setView("void-entry")
          } else {
            setView("dashboard")
            setSelectedstring(undefined)
            setSelectedPaymentstring(undefined)
            setSelectedVoidstring(undefined)
          }
        }} />
      )}

      {view === "dashboard" && <DashboardView onNavigate={(v, s) => { setView(v); if (v === "orders-entry") setSelectedstring(s); if (v === "payment-entry") setSelectedPaymentstring(s); if (v === "void-entry") setSelectedVoidstring(s); }} />}
      {view === "orders-entry" && <OrdersEntryView isCashier={isCashier} currentstring={currentstring} onSelectShift={(s, op) => { setSelectedstring(s); setSelectedOperationDay(op); setView("orders") }} />}
      {view === "orders" && <OrdersView shiftType={selectedstring} operationDay={selectedOperationDay} />}
      {view === "payment-entry" && <PaymentEntryView isCashier={isCashier} currentstring={currentstring} onSelectShift={(s, op) => { setSelectedPaymentstring(s); setSelectedOperationDay(op); setView("payment") }} />}
      {view === "payment" && <PaymentView shiftType={selectedPaymentstring} operationDay={selectedOperationDay} />}
      {view === "void-entry" && <VoidEntryView isCashier={isCashier} currentstring={currentstring} onSelectShift={(s, op) => { setSelectedVoidstring(s); setSelectedOperationDay(op); setView("void") }} />}
      {view === "void" && <VoidView shiftType={selectedVoidstring} operationDay={selectedOperationDay} />}
    </div>
  )
}

function DashboardView({ onNavigate }: { onNavigate: (v: CashierView, shiftType?: string) => void }) {
  const [counts, setCounts] = useState({ total: 0, unpaid: 0, voided: 0, dayShift: 0, nightShift: 0 })
  const user = useAuthStore((s) => s.user)
  const isCashier = user?.role === "cashier"

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const [orders, shifts] = await Promise.all([getOrders(), listShifts()])
        if (cancelled) return

        const shiftTypeById = new Map(shifts.map((s) => [s.id, s.type]))

        const dayShiftOrders = orders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === "DAY")
        const nightShiftOrders = orders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === "NIGHT")

        setCounts({
          total: orders.length,
          unpaid: orders.filter((o) => !o.isPaid && !o.isVoid).length,
          voided: orders.filter((o) => o.isVoid).length,
          dayShift: dayShiftOrders.length,
          nightShift: nightShiftOrders.length,
        })
      } catch { /* ignore */ }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
          onClick={() => onNavigate("orders-entry")}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Receipt size={24} className="text-green-600" />
            </div>
            <div>
              <Heading as="h3" className="text-lg text-admin-header-text">Orders</Heading>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {counts.total} total
                </span>
                {counts.unpaid > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    {counts.unpaid} unpaid
                  </span>
                )}
              </div>
              <p className="text-xs text-admin-muted mt-1">View all orders with filters and search.</p>
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
          onClick={() => onNavigate("payment-entry")}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Wallet size={24} className="text-blue-600" />
            </div>
            <div>
              <Heading as="h3" className="text-lg text-admin-header-text">Payment</Heading>
              <div className="flex items-center gap-2 mt-1">
                {counts.unpaid > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {counts.unpaid} unpaid
                  </span>
                ) : (
                  <span className="text-sm text-admin-muted">All orders paid</span>
                )}
              </div>
              <p className="text-xs text-admin-muted mt-1">Mark an order as paid via M-Pesa or Cash.</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 transition-colors ${
            isCashier
              ? "opacity-40 cursor-not-allowed border-2 border-red-300 bg-red-200/60"
              : "cursor-pointer border-2 border-red-400 bg-red-50/50 hover:border-red-600"
          }`}
          onClick={isCashier ? undefined : () => onNavigate("void-entry")}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle size={24} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Heading as="h3" className="text-lg text-red-700">Void Order</Heading>
                {isCashier && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                    <Lock size={10} />
                    Manager only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {isCashier ? (
                  <span className="text-sm text-admin-muted">Requires manager role</span>
                ) : counts.unpaid > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {counts.unpaid} voidable
                  </span>
                ) : (
                  <span className="text-sm text-admin-muted">No voidable orders</span>
                )}
              </div>
              <p className="text-xs text-admin-muted mt-1">
                {isCashier ? "Contact manager to void orders." : "Select and void an unpaid order."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

function OrdersEntryView({ onSelectShift, isCashier, currentstring }: { onSelectShift: (shiftType: string, operationDay?: string) => void; isCashier: boolean; currentstring?: string }) {
  const [shiftConfigs, setShiftConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [opDays, setOpDays] = useState<Record<string, string>>({})
  useEffect(() => {
    getShiftConfigs().then(setShiftConfigs).catch(() => {})
    listShifts()
      .then((shifts) => {
        const byType: Record<string, string> = {}
        for (const s of shifts) {
          const existing = byType[s.type]
          if (!existing || s.operationDay > existing) byType[s.type] = s.operationDay
        }
        setOpDays(byType)
      })
      .catch(() => {})
  }, [])

  function isDisabled(shift: string) {
    if (isCashier && !!currentstring && shift !== currentstring) return true
    if (!opDays[shift]) return true
    return false
  }
  const activeConfigs = shiftConfigs
    .filter((c) => c.isActive)
    .sort((a, b) => {
      if (currentstring && a.type === currentstring) return -1
      if (currentstring && b.type === currentstring) return 1
      return b.autoOpenTime.localeCompare(a.autoOpenTime)
    })
  return (
    <div className="space-y-4">
      {activeConfigs.length > 0 && <Heading as="h2" className="text-admin-header-text text-center text-xl">Select Shift Orders</Heading>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
        {activeConfigs.length === 0 && (
          <Card className="col-span-full border-red-500/30 bg-red-50/40 shadow-red-100/40">
            <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
              <Lock className="h-6 w-6 text-red-600" />
              <p className="text-sm font-semibold text-red-700">No shifts configured</p>
              <p className="text-xs text-red-600/80">Contact manager to configure shift schedules.</p>
            </CardContent>
          </Card>
        )}
        {activeConfigs.map((c) => {
          const isOpen = currentstring === c.type
          return (
          <Card key={c.id} className={`p-6 text-center transition-colors ${
            isDisabled(c.type)
              ? "opacity-50 cursor-not-allowed border-2 border-red-300 bg-red-50"
              : "cursor-pointer hover:border-admin-accent"
          }`} onClick={isDisabled(c.type) ? undefined : () => onSelectShift(c.type, opDays[c.type])}>
            <div className="h-16 w-16 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} className="text-blue-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text mb-2">{c.type} Shift Orders</Heading>
            <p className="text-sm font-semibold text-red-600 mt-1 mb-1">{opDays[c.type] ? `Op Day: ${opDayLabel(opDays[c.type])}` : "Op Day: —"}</p>
            <p className="text-sm text-admin-muted">{new Date("1970-01-01T" + c.autoOpenTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()} — {new Date("1970-01-01T" + c.autoCloseTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}</p>
            {isOpen && (
              <span className="mt-3 flex w-full justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> OPEN
              </span>
            </span>
            )}
          </Card>
          )
        })}
      </div>
    </div>
  )
}

function OrdersView({ shiftType }: { shiftType?: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [shiftOpDayById, setShiftOpDayById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<OrderTab>("ALL")

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      setError("")
      try {
        const [allOrders, shiftsData] = await Promise.all([getOrders(), listShifts()])
        if (cancelled) return

        const shiftTypeById = new Map(shiftsData.map((s) => [s.id, s.type]))
        const shiftOpDayById = new Map(shiftsData.map((s) => [s.id, s.operationDay.split("T")[0]]))
        const filteredOrders = shiftType
          ? allOrders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === shiftType)
          : allOrders

        setOrders(filteredOrders)
        setShiftOpDayById(shiftOpDayById)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [shiftType])

  const batchTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const o of orders) {
      if (o.batchId) {
        totals[o.batchId] = (totals[o.batchId] ?? 0) + Number(o.totalPrice)
      }
    }
    return totals
  }, [orders])

  const filtered = useMemo(() => {
    let source = orders
    switch (activeTab) {
      case "MPESA":
        source = source.filter((o) => o.isPaid && o.paymentMethod === "mpesa")
        break
      case "CASH":
        source = source.filter((o) => o.isPaid && o.paymentMethod === "cash")
        break
      case "VOID":
        source = source.filter((o) => o.isVoid)
        break
      case "UNPAID":
        source = source.filter((o) => !o.isPaid && !o.isVoid && !o.unpaidAcknowledged)
        break
      case "BATCH":
        source = source.filter((o) => o.isPaid && o.paymentType === "BATCH")
        break
      case "MARKED_UNPAID":
        source = source.filter((o) => o.unpaidAcknowledged)
        break
    }
    if (searchInput) {
      const q = searchInput.toLowerCase()
      source = source.filter((o) => {
        if (String(o.orderNumber).includes(q)) return true
        if (o.batchId) {
          const batchTotal = batchTotals[o.batchId]
          if (batchTotal !== undefined && String(Math.round(batchTotal)).includes(q)) return true
        }
        return false
      })
    }
    if (selectedDate) {
      const selectedStr = selectedDate.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
      source = source.filter((o) => {
        const orderShiftOpDay = shiftOpDayById.get(o.shiftId)
        return orderShiftOpDay === selectedStr
      })
    }
    source.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return source
  }, [orders, activeTab, searchInput, batchTotals, selectedDate, shiftOpDayById])

  const counts = useMemo(() => ({
    ALL: orders.length,
    MPESA: orders.filter((o) => o.isPaid && o.paymentMethod === "mpesa").length,
    CASH: orders.filter((o) => o.isPaid && o.paymentMethod === "cash").length,
    VOID: orders.filter((o) => o.isVoid).length,
    UNPAID: orders.filter((o) => !o.isPaid && !o.isVoid && !o.unpaidAcknowledged).length,
    MARKED_UNPAID: orders.filter((o) => o.unpaidAcknowledged).length,
    BATCH: orders.filter((o) => o.isPaid && o.paymentType === "BATCH").length,
  }), [orders])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold">#{order.orderNumber}</span>
            {!order.isVoid && !order.isPaid && !order.unpaidAcknowledged && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                NEW
              </span>
            )}
            {!order.isVoid && !order.isPaid && order.unpaidAcknowledged && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                CLOSED
              </span>
            )}
            {order.isVoid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                VOIDED
              </span>
            )}
            {order.isPaid && order.paymentType === "BATCH" && order.batchId && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                {money(batchTotals[order.batchId] ?? 0)}
              </span>
            )}
          </div>
        )
      case "mealType":
        return order.mealType
      case "paymentMethod":
        if (order.isVoid) {
          return (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              Cancelled
            </span>
          )
        }
        if (!order.isPaid) {
          if (!order.unpaidAcknowledged) {
            return (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                NOT YET
              </span>
            )
          }
          return (
            <div className="flex items-center justify-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                Unpaid
              </span>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                Manager Marked
              </span>
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center gap-1.5">
            {order.paymentMethod === "mpesa" ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">M-Pesa</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">Cash</span>
            )}
            {order.paymentType === "BATCH" && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                Batch
              </span>
            )}
          </div>
        )
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "status":
        return <StatusBadge isPaid={order.isPaid} />
      case "createdAt":
        return formatDate(order.createdAt)
      case "details":
        return (
          <Button variant="outline" size="sm" onClick={() => setDetailOrder(order)}>
            <Eye />
            Details
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Heading as="h2" className="text-admin-header-text text-xl">
            {shiftType ? `${shiftType} Shift Orders` : "Orders"}
          </Heading>
          {shiftType && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
            }`}>
              {shiftType} Shift
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {(["ALL", "UNPAID", "MPESA", "CASH", "VOID", "BATCH", "MARKED_UNPAID"] as OrderTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeTab === tab
                ? TAB_COLORS[tab].active
                : `bg-gray-50 ${TAB_COLORS[tab].inactive}`
            }`}
          >
            {TAB_LABELS[tab]}
            <span className="ml-1.5 opacity-70">({counts[tab]})</span>
          </button>
        ))}
      </div>

      {!loading && !error && (
        <DataTable
          columns={ORDER_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by order number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="max-w-sm"
              />
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Filter by date"
              />
            </div>
          }
        />
      )}

      <Dialog open={detailOrder !== null} onOpenChange={(open) => { if (!open) setDetailOrder(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{detailOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Order details and items</DialogDescription>
          </DialogHeader>

          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="text-admin-muted">Meal</div>
                <div className="font-medium">{detailOrder.mealType}</div>
                <div className="text-admin-muted">Waiter</div>
                <div className="font-medium">{detailOrder.User?.name ?? "—"}</div>
                <div className="text-admin-muted">Date</div>
                <div className="font-medium">{formatDate(detailOrder.createdAt)}</div>
                <div className="text-admin-muted">Payment</div>
                <div className="font-medium">{detailOrder.paymentMethod}</div>
                <div className="text-admin-muted">Status</div>
                <div className="font-medium">
                  <StatusBadge isPaid={detailOrder.isPaid} />
                </div>
              </div>

              <div className="space-y-2">
                {detailOrder.OrderItem.map((item) => {
                  const accomp = [item.Starch?.name, item.Vegetable?.name].filter(Boolean).join(", ")
                  return (
                    <div
                      key={`${item.orderId}-${item.menuId}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-admin-card-border p-3"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-admin-muted">
                          {item.qty} x {money(item.price)}
                          {accomp ? ` — ${accomp}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold">{money(item.qty * item.price)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-admin-accent/10 p-4">
                <span className="font-medium text-admin-header-text">Total</span>
                <span className="text-lg font-bold text-admin-header-text">{money(detailOrder.totalPrice)}</span>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VoidEntryView({ onSelectShift, isCashier, currentstring }: { onSelectShift: (shiftType: string, operationDay?: string) => void; isCashier: boolean; currentstring?: string }) {
  const [shiftConfigs, setShiftConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [opDays, setOpDays] = useState<Record<string, string>>({})
  useEffect(() => {
    getShiftConfigs().then(setShiftConfigs).catch(() => {})
    listShifts()
      .then((shifts) => {
        const byType: Record<string, string> = {}
        for (const s of shifts) {
          const existing = byType[s.type]
          if (!existing || s.operationDay > existing) byType[s.type] = s.operationDay
        }
        setOpDays(byType)
      })
      .catch(() => {})
  }, [])
  function isDisabled(shift: string) {
    if (isCashier && !!currentstring && shift !== currentstring) return true
    if (!opDays[shift]) return true
    return false
  }
  const activeConfigs = shiftConfigs
    .filter((c) => c.isActive)
    .sort((a, b) => {
      if (currentstring && a.type === currentstring) return -1
      if (currentstring && b.type === currentstring) return 1
      return b.autoOpenTime.localeCompare(a.autoOpenTime)
    })
  return (
    <div className="space-y-4">
      {activeConfigs.length > 0 && <Heading as="h2" className="text-admin-header-text text-center text-xl">Select Shift Voids</Heading>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
        {activeConfigs.length === 0 && (
          <Card className="col-span-full border-red-500/30 bg-red-50/40 shadow-red-100/40">
            <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
              <Lock className="h-6 w-6 text-red-600" />
              <p className="text-sm font-semibold text-red-700">No shifts configured</p>
              <p className="text-xs text-red-600/80">Contact manager to configure shift schedules.</p>
            </CardContent>
          </Card>
        )}
        {activeConfigs.map((c) => {
          const isOpen = currentstring === c.type
          return (
          <Card key={c.id} className={`p-6 border-2 border-red-400 bg-red-50/50 text-center transition-colors ${
            isDisabled(c.type) ? "opacity-50 cursor-not-allowed grayscale" : "hover:border-red-600 cursor-pointer"
          }`} onClick={isDisabled(c.type) ? undefined : () => onSelectShift(c.type, opDays[c.type])}>
            <div className="h-16 w-16 rounded-lg bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-600" />
            </div>
            <Heading as="h3" className="text-lg text-red-700 mb-2">{c.type} Shift Voids</Heading>
            <p className="text-sm font-semibold text-red-600 mt-1 mb-1">{opDays[c.type] ? `Op Day: ${opDayLabel(opDays[c.type])}` : "Op Day: —"}</p>
            <p className="text-sm text-admin-muted">View {c.type.toLowerCase()} shift voidable orders ({new Date("1970-01-01T" + c.autoOpenTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()} — {new Date("1970-01-01T" + c.autoCloseTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()})</p>
            {isOpen && (
              <span className="mt-3 flex w-full justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> OPEN
              </span>
            </span>
            )}
          </Card>
          )
        })}
      </div>
    </div>
  )
}

function VoidView({ shiftType }: { shiftType?: string }) {
  const user = useAuthStore((s) => s.user)
  const isCashier = user?.role === "cashier"

  const [orders, setOrders] = useState<Order[]>([])
  const [shiftOpDayById, setShiftOpDayById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    if (isCashier) return
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      try {
        const [allOrders, shiftsData] = await Promise.all([getOrders(), listShifts()])
        if (cancelled) return

        const shiftTypeById = new Map(shiftsData.map((s) => [s.id, s.type]))
        const shiftOpDayByIdMap = new Map(shiftsData.map((s) => [s.id, s.operationDay.split("T")[0]]))
        const voidableOrders = allOrders.filter((o) => !o.isPaid && !o.isVoid)
        const filteredOrders = shiftType
          ? voidableOrders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === shiftType)
          : voidableOrders

        setOrders(filteredOrders)
        setShiftOpDayById(shiftOpDayByIdMap)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [isCashier, shiftType])

  const filtered = useMemo(() => {
    let source = orders
    if (searchInput) {
      const q = searchInput.toLowerCase()
      source = source.filter((o) => String(o.orderNumber).includes(q))
    }
    if (selectedDate) {
      const selectedStr = selectedDate.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
      source = source.filter((o) => {
        const orderShiftOpDay = shiftOpDayById.get(o.shiftId)
        return orderShiftOpDay === selectedStr
      })
    }
    source.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return source
  }, [orders, searchInput, selectedDate, shiftOpDayById])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  if (isCashier) {
    return (
      <div className="space-y-4">
        <Heading as="h2" className="text-admin-header-text text-center text-xl">Void Order</Heading>
        <Card className="p-6 text-center border-gray-300 bg-gray-50">
          <Lock size={48} className="mx-auto text-gray-400 mb-4" />
          <Heading as="h3" className="text-lg text-gray-600 mb-2">Manager Only</Heading>
          <p className="text-gray-500">Void order functionality requires manager role.</p>
          <p className="text-xs text-gray-400 mt-2">Contact your manager to void orders.</p>
        </Card>
      </div>
  )
}

  async function handleVoidOrder() {
    if (!selectedOrder || !user) return
    setVoiding(true)
    try {
      await voidOrder(selectedOrder.id, user.id, voidReason || undefined)
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id))
      setSelectedOrder(null)
      setVoidReason("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void order")
    } finally {
      setVoiding(false)
    }
  }

  const VOID_COLUMNS: Column[] = [
    { label: "Order #", key: "orderNumber" },
    { label: "Meal", key: "mealType" },
    { label: "Waiter", key: "waiter" },
    { label: "Total", key: "totalPrice", align: "right" },
    { label: "Date", key: "createdAt" },
    { label: "Void Order", key: "action", isAction: true, align: "center" },
  ]

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return <span className="font-semibold">#{order.orderNumber}</span>
      case "mealType":
        return order.mealType
      case "waiter":
        return order.User?.name ?? "—"
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "createdAt":
        return formatDate(order.createdAt)
      case "action":
        return (
          <div className="flex justify-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setSelectedOrder(order)}
            >
              <Ban />
              Void
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Heading as="h2" className="text-admin-header-text text-xl">
            {shiftType ? `${shiftType} Shift Voids` : "Void Order"}
          </Heading>
          {shiftType && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
            }`}>
              {shiftType} Shift
            </span>
          )}
        </div>
      )}

      {!loading && !error && (
        <DataTable
          columns={VOID_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No voidable orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by order number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="max-w-sm"
              />
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Filter by date"
              />
            </div>
          }
        />
      )}

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setVoidReason("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Void Order #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              This will void the entire order and restore all items to stock. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="text-admin-muted">Waiter</div>
                <div className="font-medium">{selectedOrder.User?.name ?? "—"}</div>
                <div className="text-admin-muted">Total</div>
                <div className="font-medium">{money(selectedOrder.totalPrice)}</div>
                <div className="text-admin-muted">Items</div>
                <div className="font-medium">{selectedOrder.OrderItem.length}</div>
              </div>

              <div className="space-y-2">
                {selectedOrder.OrderItem.map((item) => {
                  const accomp = [item.Starch?.name, item.Vegetable?.name].filter(Boolean).join(", ")
                  return (
                    <div
                      key={`${item.orderId}-${item.menuId}`}
                      className="flex items-start justify-between gap-3 rounded-lg border-2 border-red-300 bg-red-50/50 p-3"
                    >
                      <div>
                        <div className="font-medium text-red-700">{item.name}</div>
                        <div className="mt-0.5 text-xs text-red-600">
                          {item.qty} x {money(item.price)}
                          {accomp ? ` — ${accomp}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold text-red-700">{money(item.qty * item.price)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-red-100 p-4">
                <span className="font-medium text-admin-header-text">Total</span>
                <span className="text-lg font-bold text-admin-header-text">{money(selectedOrder.totalPrice)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-admin-header-text">Reason (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {["Customer changed order", "Wrong item served", "Other"].map((reason) => (
                    <Button
                      key={reason}
                      type="button"
                      variant={voidReason === reason ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoidReason(voidReason === reason ? "" : reason)}
                    >
                      {reason}
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setSelectedOrder(null); setVoidReason("") }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleVoidOrder}
                  disabled={voiding}
                >
                  {voiding ? "Voiding..." : "Confirm Void"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentEntryView({ onSelectShift, isCashier, currentstring }: { onSelectShift: (shiftType: string, operationDay?: string) => void; isCashier: boolean; currentstring?: string }) {
  const [shiftConfigs, setShiftConfigs] = useState<{ id: string; type: string; autoOpenTime: string; autoCloseTime: string; isActive: boolean }[]>([])
  const [opDays, setOpDays] = useState<Record<string, string>>({})
  useEffect(() => {
    getShiftConfigs().then(setShiftConfigs).catch(() => {})
    listShifts()
      .then((shifts) => {
        const byType: Record<string, string> = {}
        for (const s of shifts) {
          const existing = byType[s.type]
          if (!existing || s.operationDay > existing) byType[s.type] = s.operationDay
        }
        setOpDays(byType)
      })
      .catch(() => {})
  }, [])
  function isDisabled(shift: string) {
    if (isCashier && !!currentstring && shift !== currentstring) return true
    if (!opDays[shift]) return true
    return false
  }
  const activeConfigs = shiftConfigs
    .filter((c) => c.isActive)
    .sort((a, b) => {
      if (currentstring && a.type === currentstring) return -1
      if (currentstring && b.type === currentstring) return 1
      return b.autoOpenTime.localeCompare(a.autoOpenTime)
    })
  return (
    <div className="space-y-4">
      {activeConfigs.length > 0 && <Heading as="h2" className="text-admin-header-text text-center text-xl">Select Shift Payments</Heading>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
        {activeConfigs.length === 0 && (
          <Card className="col-span-full border-red-500/30 bg-red-50/40 shadow-red-100/40">
            <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
              <Lock className="h-6 w-6 text-red-600" />
              <p className="text-sm font-semibold text-red-700">No shifts configured</p>
              <p className="text-xs text-red-600/80">Contact manager to configure shift schedules.</p>
            </CardContent>
          </Card>
        )}
        {activeConfigs.map((c) => {
          const isOpen = currentstring === c.type
          return (
          <Card key={c.id} className={`p-6 text-center transition-colors ${
            isDisabled(c.type) ? "opacity-50 cursor-not-allowed border-2 border-red-300 bg-red-50" : "cursor-pointer hover:border-admin-accent"
          }`} onClick={isDisabled(c.type) ? undefined : () => onSelectShift(c.type, opDays[c.type])}>
            <div className="h-16 w-16 rounded-lg bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <Wallet size={32} className="text-yellow-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text mb-2">{c.type} Shift Payments</Heading>
            <p className="text-sm font-semibold text-red-600 mt-1 mb-1">{opDays[c.type] ? `Op Day: ${opDayLabel(opDays[c.type])}` : "Op Day: —"}</p>
            <p className="text-sm text-admin-muted">View {c.type.toLowerCase()} shift unpaid orders ({new Date("1970-01-01T" + c.autoOpenTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()} — {new Date("1970-01-01T" + c.autoCloseTime + ":00").toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()})</p>
            {isOpen && (
              <span className="mt-3 flex w-full justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> OPEN
              </span>
            </span>
            )}
          </Card>
          )
        })}
      </div>
    </div>
  )
}

function PaymentView({ shiftType }: { shiftType?: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [shiftOpDayById, setShiftOpDayById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa" | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([])
  const [orderSearch, setOrderSearch] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [processing, setProcessing] = useState(false)
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [payMethod, setPayMethod] = useState<"cash" | "mpesa" | null>(null)
  const [payProcessing, setPayProcessing] = useState(false)
  const [payCategory, setPayCategory] = useState<"NEW" | "MARKED">("NEW")

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      setLoading(true)
      try {
        const [allOrders, shiftsData] = await Promise.all([getOrders(), listShifts()])
        if (cancelled) return

        const shiftTypeById = new Map(shiftsData.map((s) => [s.id, s.type]))
        const shiftOpDayByIdMap = new Map(shiftsData.map((s) => [s.id, s.operationDay.split("T")[0]]))
        const unpaidOrders = allOrders.filter((o) => !o.isPaid && !o.isVoid)
        const filteredOrders = shiftType
          ? unpaidOrders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === shiftType)
          : unpaidOrders

        setOrders(filteredOrders)
        setShiftOpDayById(shiftOpDayByIdMap)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
  }, [shiftType])

  const filtered = useMemo(() => {
    let source = orders
    if (payCategory === "NEW") {
      source = source.filter((o) => !o.unpaidAcknowledged)
    } else if (payCategory === "MARKED") {
      source = source.filter((o) => o.unpaidAcknowledged)
    }
    if (orderSearch) {
      const q = orderSearch.toLowerCase()
      source = source.filter((o) => String(o.orderNumber).includes(q))
    }
    if (selectedDate) {
      const selectedStr = selectedDate.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
      source = source.filter((o) => {
        const orderShiftOpDay = shiftOpDayById.get(o.shiftId)
        return orderShiftOpDay === selectedStr
      })
    }
    source.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return source
  }, [orders, orderSearch, selectedDate, payCategory, shiftOpDayById])

  const {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage,
    canNext,
    canPrev,
  } = usePagination(filtered)

  const accumulatedTotal = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0),
    [selectedOrders]
  )

  function openWizard() {
    setWizardStep(1)
    setPaymentMethod(null)
    setSelectedOrders([])
    setOrderSearch("")
    setWizardOpen(true)
  }

  function toggleOrder(order: Order) {
    setSelectedOrders((prev) =>
      prev.some((o) => o.id === order.id)
        ? prev.filter((o) => o.id !== order.id)
        : [...prev, order]
    )
  }

  async function handleConfirmPayment() {
    if (!paymentMethod || selectedOrders.length === 0) return
    setProcessing(true)
    try {
      const batchId = crypto.randomUUID()
      await Promise.all(
        selectedOrders.map((o) =>
          updateOrderPayment(o.id, paymentMethod, "BATCH", batchId)
        )
      )
      const paidIds = new Set(selectedOrders.map((o) => o.id))
      setOrders((prev) => prev.filter((o) => !paidIds.has(o.id)))
      setWizardOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payment")
    } finally {
      setProcessing(false)
    }
  }

  const PAYMENT_COLUMNS: Column[] = [
    { label: "Order #", key: "orderNumber" },
    { label: "Meal", key: "mealType" },
    { label: "Waiter", key: "waiter" },
    { label: "Total", key: "totalPrice", align: "right" },
    { label: "Date", key: "createdAt" },
    { label: "Action", key: "action", isAction: true },
  ]

  function renderCell(order: Order, column: Column): ReactNode {
    switch (column.key) {
      case "orderNumber":
        return <span className="font-semibold">#{order.orderNumber}</span>
      case "mealType":
        return order.mealType
      case "waiter":
        return order.User?.name ?? "—"
      case "totalPrice":
        return <span className="font-medium">{money(order.totalPrice)}</span>
      case "createdAt":
        return formatDate(order.createdAt)
      case "action":
        return (
          <div className="flex justify-center">
            <Button
              size="sm"
              className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
              onClick={() => { setPayOrder(order); setPayMethod(null) }}
            >
              <Banknote />
              Pay
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  const stepLabels = ["Method", "Orders"]

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-admin-muted">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Heading as="h2" className="text-admin-header-text text-xl">
            {shiftType ? `${shiftType} Shift Payments` : "Payment"}
          </Heading>
          {shiftType && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              shiftType === "DAY" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"
            }`}>
              {shiftType} Shift
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button
          className="px-6 py-6 bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
          onClick={openWizard}
        >
          <Landmark />
          Batch Payment
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {([
          { key: "NEW" as const, label: "New Orders" },
          { key: "MARKED" as const, label: "Marked Unpaid" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPayCategory(tab.key)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors ${
              payCategory === tab.key
                ? tab.key === "NEW"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                : tab.key === "NEW"
                ? "text-green-400 hover:text-green-600"
                : "text-red-400 hover:text-red-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!loading && !error && (
        <DataTable
          columns={PAYMENT_COLUMNS}
          data={paginatedItems}
          renderCell={renderCell}
          keyExtractor={(order) => order.id}
          emptyMessage="No unpaid orders found"
          pagination={{
            currentPage,
            totalPages,
            onPrev: prevPage,
            onNext: nextPage,
            canPrev,
            canNext,
          }}
          header={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by order number..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="max-w-sm"
              />
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Filter by date"
              />
            </div>
          }
        />
      )}

      {/* Single Order Payment Dialog */}
      <Dialog open={payOrder !== null} onOpenChange={(open) => { if (!open) setPayOrder(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-xs font-black uppercase tracking-widest text-green-600">Pay Order #{payOrder?.orderNumber}</DialogTitle>
          </DialogHeader>

          {payOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-admin-card-border bg-admin-content p-4 text-sm">
                <div className="text-admin-muted">Meal</div>
                <div className="font-medium">{payOrder.mealType}</div>
                <div className="text-admin-muted">Waiter</div>
                <div className="font-medium">{payOrder.User?.name ?? "—"}</div>
              </div>

              <div className="space-y-2">
                {payOrder.OrderItem.map((item) => {
                  const accomp = [item.Starch?.name, item.Vegetable?.name].filter(Boolean).join(", ")
                  return (
                    <div
                      key={`${item.orderId}-${item.menuId}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-admin-card-border p-3"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-admin-muted">
                          {item.qty} x {money(item.price)}
                          {accomp ? ` — ${accomp}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold">{money(item.qty * item.price)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-admin-accent/10 p-4">
                <span className="font-medium text-admin-header-text">Total</span>
                <span className="text-lg font-bold text-admin-header-text">{money(payOrder.totalPrice)}</span>
              </div>

              <p className="text-sm font-medium text-admin-header-text mb-2">Select payment method</p>
              <RadioGroup value={payMethod ?? ""} onValueChange={(v) => setPayMethod(v as "cash" | "mpesa")} className="flex flex-row gap-4">
                <Label
                  htmlFor="single-mpesa"
                  className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-4 transition-colors has-[button[data-state=checked]]:border-2 has-[button[data-state=checked]]:border-blue-500"
                >
                  <RadioGroupItem value="mpesa" id="single-mpesa" className="mt-0.5" />
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">M</span>
                    <span>
                      <span className="block mb-1 font-medium text-admin-header-text">M-Pesa</span>
                      <span className="block text-xs text-admin-muted">Mobile money payment</span>
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="single-cash"
                  className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-4 transition-colors has-[button[data-state=checked]]:border-2 has-[button[data-state=checked]]:border-blue-500"
                >
                  <RadioGroupItem value="cash" id="single-cash" className="mt-0.5" />
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">C</span>
                    <span>
                      <span className="block mb-1 font-medium text-admin-header-text">Cash</span>
                      <span className="block text-xs text-admin-muted">Physical cash payment</span>
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
              disabled={!payMethod || payProcessing}
              onClick={async () => {
                if (!payOrder || !payMethod) return
                setPayProcessing(true)
                try {
                  await updateOrderPayment(payOrder.id, payMethod, "SINGLE")
                  setOrders((prev) => prev.filter((o) => o.id !== payOrder.id))
                  setPayOrder(null)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to process payment")
                } finally {
                  setPayProcessing(false)
                }
              }}
            >
              {payProcessing ? "Processing..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Payment Wizard */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false) }}>
        <DialogContent className="max-w-xl sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xs font-black uppercase tracking-widest text-blue-600">Batch Payment</DialogTitle>
          </DialogHeader>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 py-2">
            {stepLabels.map((label, i) => {
              const step = (i + 1) as 1 | 2
              const isActive = wizardStep === step
              const isDone = wizardStep > step
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isDone ? "bg-blue-500" : "bg-gray-300"}`} />}
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isActive ? "text-blue-600" : isDone ? "text-blue-600" : "text-admin-muted"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isDone ? "bg-blue-100 text-blue-700" : isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-admin-muted"}`}>
                      {isDone ? "✓" : step}
                    </span>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Step 1: Payment Method */}
          {wizardStep === 1 && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium text-admin-header-text mb-2">Select payment method</p>
              <RadioGroup value={paymentMethod ?? ""} onValueChange={(v) => setPaymentMethod(v as "cash" | "mpesa")} className="flex flex-row gap-4">
                <Label
                  htmlFor="pay-mpesa"
                  className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-4 transition-colors has-[button[data-state=checked]]:border-2 has-[button[data-state=checked]]:border-blue-500"
                >
                  <RadioGroupItem value="mpesa" id="pay-mpesa" className="mt-0.5" />
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">M</span>
                    <span>
                      <span className="block mb-1 font-medium text-admin-header-text">M-Pesa</span>
                      <span className="block text-xs text-admin-muted">Mobile money payment</span>
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="pay-cash"
                  className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-admin-card-border p-4 transition-colors has-[button[data-state=checked]]:border-2 has-[button[data-state=checked]]:border-blue-500"
                >
                  <RadioGroupItem value="cash" id="pay-cash" className="mt-0.5" />
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">C</span>
                    <span>
                      <span className="block mb-1 font-medium text-admin-header-text">Cash</span>
                      <span className="block text-xs text-admin-muted">Physical cash payment</span>
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Select Orders */}
          {wizardStep === 2 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-admin-header-text">
                  Select orders to pay
                </p>
                {selectedOrders.length > 0 && (
                  <span className="text-xs font-semibold text-blue-600">{selectedOrders.length} selected</span>
                )}
              </div>
              <Input
                placeholder="Search by order number..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-72 overflow-y-auto rounded-lg border border-admin-card-border divide-y divide-admin-card-border">
                {filtered.length === 0 ? (
                  <p className="text-sm text-admin-muted text-center py-4">No orders found</p>
                ) : (
                  (() => {
                    const showSearchResults = orderSearch.trim() !== ""
                    const displayOrders = showSearchResults
                      ? filtered
                      : filtered.slice(0, 10)
                    const hiddenCount = showSearchResults ? 0 : Math.max(0, filtered.length - 10)

                    return (
                      <>
                        {displayOrders.map((order) => {
                          const isSelected = selectedOrders.some((o) => o.id === order.id)
                          return (
                            <label
                              key={order.id}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                                isSelected ? "bg-blue-50" : ""
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOrder(order)}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold">#{order.orderNumber}</span>
                                <span className="ml-2 text-xs text-admin-muted">{order.mealType}</span>
                                <span className="ml-2 text-xs text-admin-muted">{order.User?.name ?? "—"}</span>
                              </div>
                              <span className="text-sm font-medium shrink-0">{money(order.totalPrice)}</span>
                            </label>
                          )
                        })}
                        {hiddenCount > 0 && (
                          <p className="text-xs text-admin-muted text-center py-2">
                            + {hiddenCount} more — use search to find
                          </p>
                        )}
                      </>
                    )
                  })()
                )}
              </div>
              {selectedOrders.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <span className="text-sm font-medium text-admin-header-text">
                    Total ({selectedOrders.length} {selectedOrders.length === 1 ? "order" : "orders"})
                  </span>
                  <span className="text-lg font-bold text-blue-700">{money(accumulatedTotal)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <div>
                {wizardStep > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setWizardStep((s) => (s - 1) as 1 | 2)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {wizardStep < 2 ? (
                  <Button
                    type="button"
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
                    disabled={!paymentMethod}
                    onClick={() => setWizardStep((s) => (s + 1) as 1 | 2)}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                    disabled={selectedOrders.length === 0 || processing}
                    onClick={handleConfirmPayment}
                  >
                    {processing ? "Processing..." : `Confirm Payment`}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Cashier
