import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Building2, ChefHat } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"

type ActiveView = "departments" | "kitchen-config" | null

const cards: { title: string; description: string; icon: typeof Building2; view: NonNullable<ActiveView> }[] = [
  {
    title: "Restaurant Departments",
    description: "Manage departments that can request stock",
    icon: Building2,
    view: "departments",
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

      {activeView === "kitchen-config" && (
        <KitchenStockConfig onBack={() => setActiveView(null)} />
      )}

      {!activeView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <Card
              key={card.view}
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setActiveView(card.view)}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <card.icon size={24} className="text-green-600" />
                </div>
                <div className="min-w-0">
                  <Heading as="h3" className="text-lg text-admin-header-text">{card.title}</Heading>
                  <p className="text-sm text-admin-muted">{card.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Manager
