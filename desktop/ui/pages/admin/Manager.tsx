import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Building2, ChefHat, Printer, Server } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"
import PrinterConfig from "@/components/admin/PrinterConfig"
import ServerConfig from "@/components/admin/ServerConfig"
import { useAuthStore } from "@/stores/auth"

type ActiveView =
  | "departments"
  | "kitchen-config"
  | "pos-printer"
  | "server-config"
  | null

const cards: {
  title: string
  description: string
  icon: typeof Building2
  view: NonNullable<ActiveView>
  adminOnly: boolean
}[] = [
  {
    title: "Restaurant Departments",
    description: "Manage departments that can request stock",
    icon: Building2,
    view: "departments",
    adminOnly: false,
  },
  {
    title: "Kitchen Stock Configuration",
    description: "Configure how stock items convert to menu plates",
    icon: ChefHat,
    view: "kitchen-config",
    adminOnly: false,
  },
  {
    title: "POS Printer Config",
    description: "Configure USB and LAN receipt printers",
    icon: Printer,
    view: "pos-printer",
    adminOnly: false,
  },
  {
    title: "Server Connection",
    description: "Set the IP address of the backend server for this terminal",
    icon: Server,
    view: "server-config",
    adminOnly: true,
  },
]

function Manager() {
  const user = useAuthStore((s) => s.user)
  const [activeView, setActiveView] = useState<ActiveView>(null)

  const isManager = user?.role === "manager"

  const visibleCards = isManager ? cards.filter((card) => !card.adminOnly) : cards

  const resolvedView =
    isManager && activeView && cards.find((card) => card.view === activeView)?.adminOnly
      ? null
      : activeView

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">Settings</Heading>

      {resolvedView === "departments" && (
        <DepartmentManager onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "kitchen-config" && (
        <KitchenStockConfig onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "pos-printer" && (
        <PrinterConfig onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "server-config" && (
        <ServerConfig onBack={() => setActiveView(null)} />
      )}

      {!resolvedView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCards.map((card) => (
            <Card
              key={card.view}
              className="relative p-6 cursor-pointer hover:border-admin-accent transition-colors"
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
