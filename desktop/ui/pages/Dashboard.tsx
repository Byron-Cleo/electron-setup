import { useCallback, useEffect, useState } from "react"
import { ShoppingCart, DollarSign, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { cn } from "@/lib/utils"
import { getDashboardSummary } from "@/lib/api"

const REFRESH_MS = 60_000

const CHART_WIDTH = 700
const CHART_HEIGHT = 200
const PADDING = { top: 20, right: 20, bottom: 30, left: 75 }

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function niceMax(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getDashboardSummary()
      setSummary(data)
      setError("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary()
    const id = setInterval(() => {
      void fetchSummary()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchSummary])

  function handleRetry() {
    setLoading(true)
    void fetchSummary()
  }

  const shift = summary?.currentShift ?? null
  const cards = summary
    ? [
        {
          icon: ShoppingCart,
          label: "Orders",
          value: String(summary.ordersSoFar),
          subtitle: "This shift",
        },
        {
          icon: DollarSign,
          label: "Revenue",
          value: `KSh ${summary.revenueSoFar.toLocaleString()}`,
          subtitle: "This shift",
        },
        {
          icon: AlertCircle,
          label: "Outstanding Unpaid",
          value: String(summary.unpaidOutstanding.count),
          subtitle: `KSh ${summary.unpaidOutstanding.total.toLocaleString()} owed`,
          valueClassName: "text-red-600",
        },
        {
          icon: Clock,
          label: "Current Running Shift",
          value: shift ? shift.type : "—",
          subtitle: shift ? `${fmtTime(shift.autoOpenTime)}–${fmtTime(shift.autoCloseTime)}` : "No active shift",
          valueClassName: "text-green-600",
        },
      ]
    : []

  return (
    <div className="p-6 bg-admin-content text-admin-header-text min-h-screen">
      <Heading as="h1" className="mb-8 text-brand-maroon">Dashboard</Heading>

      {loading && !summary && (
        <p className="text-sm text-admin-muted">Loading dashboard…</p>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-red-600">
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <Card className="mt-6 p-8 w-full">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg text-admin-header-text">Sales Overview</CardTitle>
              <p className="text-sm text-admin-muted">Last 7 days</p>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <SalesChart data={summary.last7Days} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, subtitle, valueClassName }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  value: string
  subtitle: string
  valueClassName?: string
}) {
  return (
    <Card size="sm" className="p-4">
      <div className="h-10 w-10 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center mb-3">
        <Icon size={20} />
      </div>
      <CardDescription className="text-sm font-semibold uppercase tracking-wide text-brand-red">{label}</CardDescription>
      <div className={cn("text-lg font-bold mt-1", valueClassName ?? "text-admin-header-text")}>{value}</div>
      {subtitle && <p className="text-xs text-admin-muted mt-0.5">{subtitle}</p>}
    </Card>
  )
}

function SalesChart({ data }: { data: DashboardDayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const rawMax = data.length ? Math.max(...data.map((d) => d.value)) : 0
  const maxVal = rawMax > 0 ? niceMax(rawMax) : 1000

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom
  const baseY = CHART_HEIGHT - PADDING.bottom
  const xStep = data.length > 1 ? plotW / (data.length - 1) : 0

  const points = data.map((d, i) => ({
    x: PADDING.left + i * xStep,
    y: PADDING.top + plotH - (d.value / maxVal) * plotH,
  }))
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z`
    : ""
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f))

  const tip = (() => {
    if (hover === null) return null
    const tw = 176
    const th = 52
    const { x, y } = points[hover]
    const tx = Math.max(PADDING.left, Math.min(x - tw / 2, CHART_WIDTH - PADDING.right - tw))
    const above = y - th - 14 >= PADDING.top
    const ty = above ? y - th - 14 : y + 14
    return { tw, th, tx, ty, point: points[hover], day: data[hover] }
  })()

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX)
      if (dist < best) {
        best = dist
        nearest = i
      }
    })
    setHover(nearest)
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-4/5 min-w-[700px] lg:min-w-0 h-auto mx-auto cursor-pointer"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0087D4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0087D4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yLabels.map((val) => {
          const y = PADDING.top + plotH - (val / maxVal) * plotH
          return (
            <g key={val}>
              <line x1={PADDING.left} y1={y} x2={CHART_WIDTH - PADDING.right} y2={y} stroke="#E5E5E5" strokeWidth="1" />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="text-[6px] fill-admin-muted">
                KSh {val.toLocaleString()}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#0087D4" strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 6 : 4} fill="#0087D4" stroke="white" strokeWidth="2" />
            <text x={p.x} y={CHART_HEIGHT - 6} textAnchor="middle" className="text-xs fill-admin-muted">
              {data[i].label}
            </text>
          </g>
        ))}

        {tip && (
          <g pointerEvents="none">
            <line
              x1={tip.point.x}
              y1={PADDING.top}
              x2={tip.point.x}
              y2={baseY}
              stroke="#0087D4"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.45"
            />
            <rect x={tip.tx} y={tip.ty} width={tip.tw} height={tip.th} rx="6" fill="#111827" opacity="0.96" />
            <text x={tip.tx + tip.tw / 2} y={tip.ty + 20} textAnchor="middle" fontSize="11" fill="#9ca3af">
              {tip.day.label}, {fmtDate(tip.day.date)}
            </text>
            <text x={tip.tx + tip.tw / 2} y={tip.ty + 41} textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">
              KSh {tip.day.value.toLocaleString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

export default Dashboard
