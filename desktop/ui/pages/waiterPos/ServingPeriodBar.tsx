import { Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getActiveMealPeriods,
  type ActiveMealPeriod,
  type MealPeriodLabel,
} from "@/lib/mealPeriod"

const PERIOD_ICONS: Record<MealPeriodLabel, typeof Sunrise> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Moon,
  DESSERT: CakeSlice,
  BEVERAGE: CupSoda,
}

interface Props {
  mealPeriod: string
  onSelectPeriod: (period: string) => void
}

export function ServingPeriodBar({ mealPeriod, onSelectPeriod }: Props) {
  const periods: ActiveMealPeriod[] = getActiveMealPeriods(new Date().getHours())

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      {periods.map((p) => {
        const Icon = PERIOD_ICONS[p.period]
        const current = p.period === mealPeriod
        return (
          <button
            key={p.period}
            type="button"
            disabled={!p.isActive}
            onClick={() => p.isActive && onSelectPeriod(p.period)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-5 py-3 text-2xl font-semibold transition-colors",
              current
                ? "bg-green-600 text-white shadow-sm"
                : p.isActive
                  ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                  : "bg-red-50 text-red-500 border border-red-200 opacity-60 cursor-not-allowed",
            )}
          >
            <Icon size={28} />
            {p.period}
          </button>
        )
      })}
    </div>
  )
}

export default ServingPeriodBar
