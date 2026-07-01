import { useState, useEffect } from "react"
import { Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { WaiterHeader } from "./WaiterHeader"
import { WaiterDateTime } from "./WaiterDateTime"
import { cn } from "@/lib/utils"

type MealPeriod = {
  period: string
  icon: typeof Sunrise
  description: string
}

type EnrichedPeriod = MealPeriod & {
  isActive: boolean
  servingHours: string
  badgeLabel: string
}

const mealPeriods: MealPeriod[] = [
  { period: "BREAKFAST", icon: Sunrise, description: "Morning meals" },
  { period: "LUNCH", icon: Sun, description: "Midday meals" },
  { period: "DINNER", icon: Moon, description: "Evening meals" },
  { period: "DESSERT", icon: CakeSlice, description: "Sweet treats" },
  { period: "BEVERAGE", icon: CupSoda, description: "Drinks" },
]

function getActiveMealPeriods(hour: number, periods: MealPeriod[]): EnrichedPeriod[] {
  return periods.map((p) => {
    switch (p.period) {
      case "BREAKFAST": {
        const active = hour >= 6 && hour < 12
        return { ...p, isActive: active, servingHours: "6:00 AM - 11:59 AM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "LUNCH": {
        const active = hour >= 12 && hour < 18
        return { ...p, isActive: active, servingHours: "12:00 PM - 5:59 PM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "DINNER": {
        const active = hour >= 18 || hour < 6
        return { ...p, isActive: active, servingHours: "6:00 PM - 5:59 AM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "DESSERT":
        return { ...p, isActive: true, servingHours: "Always Available", badgeLabel: "Always Available" }
      case "BEVERAGE":
        return { ...p, isActive: true, servingHours: "Always Available", badgeLabel: "Always Available" }
      default:
        return { ...p, isActive: false, servingHours: "", badgeLabel: "Closed" }
    }
  })
}

export function WaiterPOS() {
  const [hour, setHour] = useState(new Date().getHours())

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000)
    return () => clearInterval(id)
  }, [])

  const periods = getActiveMealPeriods(hour, mealPeriods)
  const activePeriods = periods.filter((p) => p.isActive)
  const closedPeriods = periods.filter((p) => !p.isActive)

  function renderCard({ period, icon: Icon, description, isActive, servingHours, badgeLabel }: EnrichedPeriod) {
    return (
      <Card
        key={period}
        className={cn(
          "relative w-48 transition-all",
          isActive
            ? "group cursor-pointer hover:shadow-lg hover:-translate-y-1"
            : "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
            isActive
              ? "bg-brand-green text-white"
              : "bg-gray-300 text-gray-600",
          )}
        >
          {badgeLabel}
        </span>

        <CardContent className="flex flex-col items-center justify-center gap-2 p-5 pt-6">
          <div
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center transition-colors",
              isActive
                ? "bg-brand-maroon/10 text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white"
                : "bg-gray-200 text-gray-400",
            )}
          >
            <Icon size={28} />
          </div>
          <span className="text-base font-bold text-brand-ebony text-center">{period}</span>
          <span className="text-xs text-brand-ebony/60 text-center">{description}</span>
          <span className="text-[10px] text-gray-400 text-center">{servingHours}</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-screen bg-brand-light flex flex-col">
      <div className="w-full mx-auto max-w-[1400px] flex-1 flex flex-col">
        <WaiterHeader />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-center mb-6">
            <WaiterDateTime />
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-bold text-brand-green uppercase tracking-wider mb-4">Now Serving</h2>
              <div className="flex flex-wrap justify-center gap-4">
                {activePeriods.map(renderCard)}
              </div>
            </section>

            {closedPeriods.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Closed</h2>
                <div className="flex flex-wrap justify-center gap-4">
                  {closedPeriods.map(renderCard)}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default WaiterPOS
