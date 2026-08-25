import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Sunrise, Sun, Moon, CakeSlice, CupSoda, Ban } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { cn } from "@/lib/utils"
import { getActiveMealPeriods, type ActiveMealPeriod, type MealPeriodLabel } from "@/lib/mealPeriod"
import { useWaiterOrder } from "./WaiterOrderContext"
import VoidOrdersDialog from "@/components/waiterPos/VoidOrdersDialog"

const PERIOD_META: Record<MealPeriodLabel, { icon: typeof Sunrise; description: string }> = {
  BREAKFAST: { icon: Sunrise, description: "Morning meals" },
  LUNCH: { icon: Sun, description: "Midday meals" },
  DINNER: { icon: Moon, description: "Evening meals" },
  DESSERT: { icon: CakeSlice, description: "Sweet treats" },
  BEVERAGE: { icon: CupSoda, description: "Drinks" },
}

type CardPeriod = ActiveMealPeriod & { icon: typeof Sunrise; description: string }

export function WaiterPOS() {
  const navigate = useNavigate()
  const [hour, setHour] = useState(new Date().getHours())
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const { voidedOrders } = useWaiterOrder()

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000)
    return () => clearInterval(id)
  }, [])

  const periods: CardPeriod[] = getActiveMealPeriods(hour).map((p) => ({
    ...p,
    icon: PERIOD_META[p.period].icon,
    description: PERIOD_META[p.period].description,
  }))
  const activePeriods = periods.filter((p) => p.isActive)
  const closedPeriods = periods.filter((p) => !p.isActive)

  function renderCard({ period, icon: Icon, description, isActive, servingHours, badgeLabel }: CardPeriod) {
    return (
      <Card
        key={period}
        onClick={() => isActive && navigate(`/waiter/menu/${period}`)}
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
    <div className="space-y-8">
      <section>
        <Heading as="h2" className="text-sm text-brand-green uppercase tracking-wider mb-4">Now Serving</Heading>
        <div className="flex flex-wrap justify-center gap-4">
          {activePeriods.map(renderCard)}
          {voidedOrders.length > 0 && (
            <Card
              onClick={() => setVoidDialogOpen(true)}
              className="relative w-48 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-red-200 bg-red-50"
            >
              <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">
                {voidedOrders.length}
              </span>
              <CardContent className="flex flex-col items-center justify-center gap-2 p-5 pt-6">
                <div className="h-14 w-14 rounded-full flex items-center justify-center bg-red-100 text-red-600">
                  <Ban size={28} />
                </div>
                <span className="text-base font-bold text-red-700 text-center">VOID ORDERS</span>
                <span className="text-xs text-red-600/80 text-center">
                  {voidedOrders.length === 1
                    ? "1 order needs regeneration"
                    : `${voidedOrders.length} orders need regeneration`}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {closedPeriods.length > 0 && (
        <section>
          <Heading as="h2" className="text-sm text-gray-400 uppercase tracking-wider mb-4">Closed</Heading>
          <div className="flex flex-wrap justify-center gap-4">
            {closedPeriods.map(renderCard)}
          </div>
        </section>
      )}

      <VoidOrdersDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen} />
    </div>
  )
}

export default WaiterPOS
