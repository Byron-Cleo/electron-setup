import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Building2, ChefHat, Printer, Server, BookOpen, Globe } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"
import PrinterConfig from "@/components/admin/PrinterConfig"
import ServerConfig from "@/components/admin/ServerConfig"
import ServerInstallationGuide from "@/components/admin/ServerInstallationGuide"
import WebInterfaceGuide from "@/components/admin/WebInterfaceGuide"

type ActiveView =
  | "departments"
  | "kitchen-config"
  | "pos-printer"
  | "server-config"
  | "server-guide"
  | "web-interface-guide"
  | null

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
  {
    title: "POS Printer Config",
    description: "Configure USB and LAN receipt printers",
    icon: Printer,
    view: "pos-printer",
  },
  {
    title: "Server Connection",
    description: "Set the IP address of the backend server for this terminal",
    icon: Server,
    view: "server-config",
  },
  {
    title: "Server & Installation Guide",
    description: "Step-by-step setup for the server and each POS terminal",
    icon: BookOpen,
    view: "server-guide",
  },
  {
    title: "Web Interface Setup (WiFi)",
    description: "Serve the app over the network so any device can use it in a browser",
    icon: Globe,
    view: "web-interface-guide",
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

      {activeView === "pos-printer" && (
        <PrinterConfig onBack={() => setActiveView(null)} />
      )}

      {activeView === "server-config" && (
        <ServerConfig onBack={() => setActiveView(null)} />
      )}

      {activeView === "server-guide" && (
        <ServerInstallationGuide onBack={() => setActiveView(null)} />
      )}

      {activeView === "web-interface-guide" && (
        <WebInterfaceGuide onBack={() => setActiveView(null)} />
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
