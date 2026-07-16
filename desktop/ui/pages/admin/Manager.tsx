import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Package, Building2, ChefHat } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"
import StockSupplyCategories from "./StockSupplyCategories"

type ActiveView = "departments" | "stock-supply-categories" | "kitchen-config" | null

const cards: { title: string; description: string; icon: typeof Building2; view: NonNullable<ActiveView> }[] = [
  {
    title: "Restaurant Departments",
    description: "Manage departments that can request stock",
    icon: Building2,
    view: "departments",
  },
  {
    title: "Stock Supply Categories",
    description: "Manage types of raw materials",
    icon: Package,
    view: "stock-supply-categories",
  },
  {
    title: "Kitchen Stock Configuration",
    description: "Configure how stock items convert to menu plates",
    icon: ChefHat,
    view: "kitchen-config",
  },
]

function Manager() {
  const [activeView, setActiveView] = useState<ActiveView>(null)

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">Settings</Heading>

      {activeView === "departments" && (
        <DepartmentManager onBack={() => setActiveView(null)} />
      )}

      {activeView === "stock-supply-categories" && (
        <StockSupplyCategories onBack={() => setActiveView(null)} />
      )}

      {activeView === "kitchen-config" && (
        <KitchenStockConfig onBack={() => setActiveView(null)} />
      )}

      {!activeView && (
        <div className="flex gap-6">
          {cards.map((card) => (
            <Card
              key={card.view}
              className="w-[300px] bg-admin-card border-admin-card-border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveView(card.view)}
            >
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="h-14 w-14 rounded-full bg-admin-accent/10 flex items-center justify-center">
                  <card.icon className="h-7 w-7 text-admin-accent" />
                </div>
                <div>
                  <Heading as="h3" className="text-admin-header-text">{card.title}</Heading>
                  <p className="text-sm text-admin-header-text/60 mt-1">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Manager
