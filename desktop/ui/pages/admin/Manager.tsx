import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import { Building2, ChefHat, Printer, Server, BookOpen, Globe, Database, Terminal, PackageCheck, ListChecks, MonitorDown, Network, Luggage } from "lucide-react"
import DepartmentManager from "@/components/admin/DepartmentManager"
import KitchenStockConfig from "@/components/admin/KitchenStockConfig"
import PrinterConfig from "@/components/admin/PrinterConfig"
import ServerConfig from "@/components/admin/ServerConfig"
import ServerInstallationGuide from "@/components/admin/ServerInstallationGuide"
import WebInterfaceGuide from "@/components/admin/WebInterfaceGuide"
import PostgresGuide from "@/components/admin/PostgresGuide"
import NodeJsGuide from "@/components/admin/NodeJsGuide"
import BuildInstallerGuide from "@/components/admin/BuildInstallerGuide"
import DataEntryGuide from "@/components/admin/DataEntryGuide"
import PrinterDriversGuide from "@/components/admin/PrinterDriversGuide"
import NetworkTestGuide from "@/components/admin/NetworkTestGuide"
import PreDeploymentGuide from "@/components/admin/PreDeploymentGuide"
import { useAuthStore } from "@/stores/auth"

type ActiveView =
  | "departments"
  | "kitchen-config"
  | "pos-printer"
  | "server-config"
  | "server-guide"
  | "web-interface-guide"
  | "postgres-guide"
  | "nodejs-guide"
  | "build-installer-guide"
  | "data-entry-guide"
  | "printer-drivers-guide"
  | "network-test-guide"
  | "pre-deploy-guide"
  | null

const cards: {
  title: string
  description: string
  icon: typeof Building2
  view: NonNullable<ActiveView>
  adminOnly: boolean
  step?: number
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
  {
    title: "Pre-Deployment Checklist (Before You Travel)",
    description: "Build, test and prepare everything at home first",
    icon: Luggage,
    view: "pre-deploy-guide",
    adminOnly: true,
    step: 1,
  },
  {
    title: "Install Node.js (Server)",
    description: "Install the runtime the backend runs on",
    icon: Terminal,
    view: "nodejs-guide",
    adminOnly: true,
    step: 2,
  },
  {
    title: "PostgreSQL Setup Guide",
    description: "Install the database, keep it running, and connect it to the backend",
    icon: Database,
    view: "postgres-guide",
    adminOnly: true,
    step: 3,
  },
  {
    title: "Server & Installation Guide",
    description: "Step-by-step setup for the server and each POS terminal",
    icon: BookOpen,
    view: "server-guide",
    adminOnly: true,
    step: 4,
  },
  {
    title: "Build the Windows Installer",
    description: "Create the .exe that installs the app on every terminal",
    icon: PackageCheck,
    view: "build-installer-guide",
    adminOnly: true,
    step: 5,
  },
  {
    title: "Enter Restaurant Data",
    description: "Add your menu, stock, departments and staff accounts",
    icon: ListChecks,
    view: "data-entry-guide",
    adminOnly: true,
    step: 6,
  },
  {
    title: "Install Printer Drivers",
    description: "Set up receipt printers on each terminal",
    icon: MonitorDown,
    view: "printer-drivers-guide",
    adminOnly: true,
    step: 7,
  },
  {
    title: "Final Network Test",
    description: "Verify the whole system works before opening",
    icon: Network,
    view: "network-test-guide",
    adminOnly: true,
    step: 8,
  },
  {
    title: "Web Interface Setup (WiFi)",
    description: "Serve the app over the network so any device can use it in a browser",
    icon: Globe,
    view: "web-interface-guide",
    adminOnly: true,
    step: 9,
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

      {resolvedView === "server-guide" && (
        <ServerInstallationGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "web-interface-guide" && (
        <WebInterfaceGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "postgres-guide" && (
        <PostgresGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "nodejs-guide" && (
        <NodeJsGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "build-installer-guide" && (
        <BuildInstallerGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "data-entry-guide" && (
        <DataEntryGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "printer-drivers-guide" && (
        <PrinterDriversGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "network-test-guide" && (
        <NetworkTestGuide onBack={() => setActiveView(null)} />
      )}

      {resolvedView === "pre-deploy-guide" && (
        <PreDeploymentGuide onBack={() => setActiveView(null)} />
      )}

      {!resolvedView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCards.map((card) => (
            <Card
              key={card.view}
              className="relative p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setActiveView(card.view)}
            >
              {card.step && (
                <span className="absolute top-3 right-3 h-7 w-7 rounded-full bg-admin-accent text-white text-sm font-bold flex items-center justify-center">
                  {card.step}
                </span>
              )}
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
