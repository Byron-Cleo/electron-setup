import { Sunrise, Sun, Moon, CakeSlice, CupSoda } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const mealPeriods = [
  { period: "BREAKFAST", icon: Sunrise, description: "Morning meals" },
  { period: "LUNCH", icon: Sun, description: "Midday meals" },
  { period: "DINNER", icon: Moon, description: "Evening meals" },
  { period: "DESSERT", icon: CakeSlice, description: "Sweet treats" },
  { period: "BEVERAGE", icon: CupSoda, description: "Drinks" },
]

function WaiterPOS() {
  return (
    <div className="min-h-screen bg-brand-light p-8">
      <h1 className="text-3xl font-bold text-brand-maroon">Waiter POS</h1>
      <p className="text-brand-ebony/60 mt-2">Select a meal period to start taking orders</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-8">
        {mealPeriods.map(({ period, icon: Icon, description }) => (
          <Card
            key={period}
            className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 p-8">
              <div className="h-16 w-16 rounded-full bg-brand-maroon/10 flex items-center justify-center text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white transition-colors">
                <Icon size={32} />
              </div>
              <span className="text-lg font-bold text-brand-ebony">{period}</span>
              <span className="text-sm text-brand-ebony/60">{description}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default WaiterPOS
