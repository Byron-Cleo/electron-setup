import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Package, Building2, ChefHat } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"

const cards = [
  {
    title: "Restaurant Departments",
    description: "Manage departments that can request stock",
    icon: Building2,
    path: "/admin/manager/departments",
  },
  {
    title: "Stock Supply Categories",
    description: "Manage types of raw materials",
    icon: Package,
    path: "/admin/manager/stock-supply-categories",
  },
  {
    title: "Kitchen Stock Configuration",
    description: "Configure how stock items convert to menu plates",
    icon: ChefHat,
    path: "/admin/manager/kitchen-config",
  },
]

function Manager() {
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<string | null>(null)

  if (activeView === "departments") {
    return <DepartmentManager onBack={() => setActiveView(null)} />
  }

  if (activeView === "kitchen-config") {
    return <KitchenStockConfig onBack={() => setActiveView(null)} />
  }

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">Settings</Heading>
      <div className="flex gap-6">
        {cards.map((card) => (
          <Card
            key={card.path}
            className="w-[300px] bg-admin-card border-admin-card-border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              if (card.path === "/admin/manager/departments") {
                setActiveView("departments")
              } else if (card.path === "/admin/manager/kitchen-config") {
                setActiveView("kitchen-config")
              } else {
                navigate(card.path)
              }
            }}
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
    </div>
  )
}

export default Manager
