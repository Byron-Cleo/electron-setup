import { Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { WaiterHeader } from "./WaiterHeader"

const mealPeriods = [
  { period: "BREAKFAST", icon: Sunrise, description: "Morning meals" },
  { period: "LUNCH", icon: Sun, description: "Midday meals" },
  { period: "DINNER", icon: Moon, description: "Evening meals" },
  { period: "DESSERT", icon: CakeSlice, description: "Sweet treats" },
  { period: "BEVERAGE", icon: CupSoda, description: "Drinks" },
]

export function WaiterPOS() {
  return (
    <div className="h-screen bg-brand-light flex flex-col">
      <div className="w-full mx-auto max-w-[1400px] flex-1 flex flex-col">
        <WaiterHeader />

        <main className="flex-1 p-6">
          <p className="text-brand-ebony/60">Select a meal period to start taking orders</p>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {mealPeriods.map(({ period, icon: Icon, description }) => (
              <Card
                key={period}
                className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 w-48"
              >
                <CardContent className="flex flex-col items-center justify-center gap-2 p-5">
                  <div className="h-14 w-14 rounded-full bg-brand-maroon/10 flex items-center justify-center text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white transition-colors">
                    <Icon size={28} />
                  </div>
                  <span className="text-base font-bold text-brand-ebony text-center">{period}</span>
                  <span className="text-xs text-brand-ebony/60 text-center">{description}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export default WaiterPOS