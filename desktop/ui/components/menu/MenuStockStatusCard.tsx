import { useState, useEffect, useMemo } from "react"
import { Flame, TrendingUp, PackageX, AlertTriangle, Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { cn } from "@/lib/utils"
import { getMenuStockStatus, type MenuStockStatus } from "@/lib/api"
import { getActiveMealPeriods, type MealPeriodLabel } from "@/lib/mealPeriod"

const PERIOD_ICONS: Record<MealPeriodLabel, typeof Sunrise> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Moon,
  DESSERT: CakeSlice,
  BEVERAGE: CupSoda,
}

function getDefaultPeriod(): MealPeriodLabel {
  const now = new Date().getHours()
  const periods = getActiveMealPeriods(now)
  const match = periods.find((p) => p.badgeLabel === "Now Serving")
  return match?.period ?? periods.find((p) => p.isActive)?.period ?? "BREAKFAST"
}

function StatusSection({
  icon: Icon,
  title,
  color,
  items,
  showRemaining,
}: {
  icon: typeof Flame
  title: string
  color: "green" | "orange" | "red"
  items: MenuStockStatus["selling"]
  showRemaining: boolean
}) {
  const badgeClass =
    color === "green"
      ? "bg-green-600"
      : color === "orange"
        ? "bg-orange-600"
        : "bg-red-600"
  const headerClass =
    color === "green"
      ? "text-green-700"
      : color === "orange"
        ? "text-orange-700"
        : "text-red-700"
  const borderClass =
    color === "green"
      ? "border-green-200 bg-green-50/40"
      : color === "orange"
        ? "border-orange-200 bg-orange-50/40"
        : "border-red-200 bg-red-50/40"

  return (
    <section className={`rounded-xl border p-4 ${borderClass}`}>
      <header className="flex items-center gap-2 mb-3">
        <Icon size={16} className={headerClass} />
        <Heading as="h3" className={`text-sm font-semibold ${headerClass}`}>{title}</Heading>
        <span className={`ml-auto inline-flex items-center justify-center h-5 min-w-5 rounded-full text-white text-[10px] font-bold px-1.5 ${badgeClass}`}>
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-admin-muted">No plates yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{item.name}</span>
              <span className={`shrink-0 text-xs font-medium ${headerClass}`}>
                {showRemaining ? `${item.remaining} plates` : "0 plates"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function MenuStockStatusCard() {
  const [period, setPeriod] = useState<MealPeriodLabel>(getDefaultPeriod)
  const [status, setStatus] = useState<MenuStockStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    getMenuStockStatus(period)
      .then((data) => {
        if (cancelled) return
        setStatus(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load stock status")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const periods = useMemo(() => getActiveMealPeriods(new Date().getHours()), [])

  const shiftLabel = status?.shift ? (status.shift.type === "DAY" ? "Day Shift" : "Night Shift") : null

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-green/10 flex items-center justify-center">
            <Flame size={20} className="text-brand-green" />
          </div>
          <div>
            <Heading as="h2" className="text-lg text-admin-header-text">
              Menu Plate Movement Status
            </Heading>
            <p className="text-xs text-admin-muted">
              {shiftLabel
                ? `Current ${shiftLabel} production — meal period based`
                : "No running shift — open a shift to see production"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:ml-auto">
          {periods.map((p) => {
            const Icon = PERIOD_ICONS[p.period]
            const current = p.period === period
            return (
              <button
                key={p.period}
                type="button"
                disabled={!p.isActive}
                onClick={() => p.isActive && setPeriod(p.period)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  current
                    ? "bg-green-600 text-white shadow-sm"
                    : p.isActive
                      ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                      : "bg-red-50 text-red-500 border border-red-200 opacity-60 cursor-not-allowed",
                )}
              >
                <Icon size={14} />
                {p.period}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-admin-muted">Loading menu stock status...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusSection
            icon={TrendingUp}
            title="Selling Now"
            color="green"
            items={status?.selling ?? []}
            showRemaining
          />
          <StatusSection
            icon={AlertTriangle}
            title="Running Low (≤ 5)"
            color="red"
            items={status?.runningLow ?? []}
            showRemaining
          />
          <StatusSection
            icon={PackageX}
            title="Sold Out"
            color="orange"
            items={status?.soldOut ?? []}
            showRemaining={false}
          />
        </div>
      )}
    </Card>
  )
}
