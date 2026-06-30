import { ShoppingCart, DollarSign, Users, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const statCards = [
  { icon: ShoppingCart, label: "Total Orders", value: "156", trend: "+12% this week", trendUp: true },
  { icon: DollarSign, label: "Revenue", value: "KSh 4,850", trend: "+8% vs last week", trendUp: true },
  { icon: Users, label: "Tables Served", value: "42", trend: "12 currently", trendUp: null },
  { icon: Clock, label: "Avg. Prep Time", value: "18m", trend: "-3m from last week", trendUp: false },
]

const chartData = [
  { day: "Mon", value: 12000 },
  { day: "Tue", value: 18000 },
  { day: "Wed", value: 14000 },
  { day: "Thu", value: 21000 },
  { day: "Fri", value: 16000 },
  { day: "Sat", value: 24000 },
  { day: "Sun", value: 19000 },
]

const CHART_WIDTH = 700
const CHART_HEIGHT = 200
const PADDING = { top: 20, right: 20, bottom: 30, left: 75 }
const plotW = CHART_WIDTH - PADDING.left - PADDING.right
const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom
const maxVal = Math.max(...chartData.map((d) => d.value))
const minVal = 0
const xStep = plotW / (chartData.length - 1)
const points = chartData.map((d, i) => ({
  x: PADDING.left + i * xStep,
  y: PADDING.top + plotH - ((d.value - minVal) / (maxVal - minVal)) * plotH,
  value: d.value,
}))
const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
const areaPath = `${linePath} L${points[points.length - 1].x},${CHART_HEIGHT - PADDING.bottom} L${points[0].x},${CHART_HEIGHT - PADDING.bottom} Z`
const yLabels = [0, 5000, 10000, 15000, 20000]

function Dashboard() {
  return (
    <div className="p-6 bg-admin-content text-admin-header-text min-h-screen">
      <h1 className="font-bold text-3xl mb-8 text-brand-maroon">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card className="mt-6 p-8 w-full">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg text-admin-header-text">Sales Overview</CardTitle>
          <p className="text-sm text-admin-muted">Last 7 days</p>
        </CardHeader>
        <CardContent className="px-0 pb-0">

        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-4/5 h-auto mx-auto">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0087D4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0087D4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yLabels.map((val) => {
            const y = PADDING.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH
            return (
              <g key={val}>
                <line x1={PADDING.left} y1={y} x2={CHART_WIDTH - PADDING.right} y2={y} stroke="#E5E5E5" strokeWidth="1" />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="text-[6px] fill-admin-muted">
                  KSh {val}
                </text>
              </g>
            )
          })}

          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={linePath} fill="none" stroke="#0087D4" strokeWidth="2" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#0087D4" stroke="white" strokeWidth="2" />
              <text x={p.x} y={CHART_HEIGHT - 6} textAnchor="middle" className="text-xs fill-admin-muted">
                {chartData[i].day}
              </text>
            </g>
          ))}
        </svg>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, trend, trendUp }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  value: string
  trend: string | null
  trendUp: boolean | null
}) {
  return (
    <Card size="sm" className="p-4">
      <div className="h-10 w-10 rounded-lg bg-admin-accent/10 text-admin-accent flex items-center justify-center mb-3">
        <Icon size={20} />
      </div>
      <CardDescription className="text-sm">{label}</CardDescription>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-lg font-bold text-admin-header-text">{value}</span>
        {trend && (
          <span className={`text-xs ${trendUp === true ? "text-green-600" : trendUp === false ? "text-red-500" : "text-admin-muted"}`}>
            {trend}
          </span>
        )}
      </div>
    </Card>
  )
}

export default Dashboard
