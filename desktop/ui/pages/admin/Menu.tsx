import { useState, useEffect } from "react"
import { UtensilsCrossed, List, Plus, Beef, Archive, type LucideIcon } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import BackButton from "@/components/shared/BackButton"
import CookedFoodTable from "@/components/menu/CookedFoodTable"
import AllMenuTable from "@/components/menu/AllMenuTable"
import DiscontinuedMenusTable from "@/components/menu/DiscontinuedMenusTable"
import AccompanimentsTable from "@/components/menu/AccompanimentsTable"
import CreateMenuDialog from "@/components/menu/CreateMenuDialog"
import MenuStockStatusCard from "@/components/menu/MenuStockStatusCard"
import RemainingStockCard from "@/components/menu/RemainingStockCard"
import { getCookedMenus } from "@/lib/api"

type MenuView = "dashboard" | "cooked-food" | "remaining-stock" | "all-menu"
type MenuSubView = "list" | "discontinued" | "accompaniments" | null
type MenuTableTab = "all" | "discontinued"

const MENU_TABLE_TABS: { key: MenuTableTab; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All Menus", icon: List },
  { key: "discontinued", label: "Discontinued Menus", icon: Archive },
]

function MenuTableNav({ active, onSelect }: { active: MenuTableTab; onSelect: (tab: MenuTableTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-admin-card-border">
      {MENU_TABLE_TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
              isActive
                ? "border-b-2 border-primary text-primary font-semibold"
                : "text-admin-muted hover:text-admin-header-text",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Menu() {
  const [view, setView] = useState<MenuView>("dashboard")
  const [subView, setSubView] = useState<MenuSubView>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogEditId, setDialogEditId] = useState<string | null>(null)
  const [readyCount, setReadyCount] = useState(0)

  function loadReadyCount() {
    getCookedMenus()
      .then((items) => setReadyCount(items.filter((item) => item.cooking.totalAvailable > 0).length))
      .catch(() => {})
  }

  useEffect(() => {
    loadReadyCount()
  }, [])

  function handleBackFromSub() {
    setSubView(null)
  }

  function handleBackToDashboard() {
    setView("dashboard")
    setSubView(null)
    loadReadyCount()
  }

  function handleMenuNavSelect(tab: MenuTableTab) {
    setSubView(tab === "all" ? "list" : "discontinued")
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">Menu/Dispatch</Heading>

      {view === "dashboard" && (
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("cooked-food")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <UtensilsCrossed size={24} className="text-orange-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">
                  Today&apos;s Cooked Food
                </Heading>
                <div className="flex items-center gap-2 mt-1">
                  {readyCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      {readyCount} Ready for Serving
                    </span>
                  ) : (
                    <span className="text-sm text-admin-muted">View cooked menu items</span>
                  )}
                </div>
                <p className="text-xs text-admin-muted mt-1">View cooked menu items ready for serving</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => { setView("all-menu"); setSubView(null) }}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <List size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">
                  All Restaurant Menu
                </Heading>
                <p className="text-sm text-admin-muted">View all menu items</p>
                <p className="text-xs text-admin-muted mt-1">Manage the full restaurant menu catalog</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {view === "dashboard" && <MenuStockStatusCard />}

      {view === "cooked-food" && (
        <div className="space-y-4">
          <BackButton onClick={handleBackToDashboard} />
          <CookedFoodTable onRefresh={() => loadReadyCount()} />
        </div>
      )}

      {view === "remaining-stock" && (
        <div className="space-y-4">
          <BackButton onClick={handleBackToDashboard} />
          <RemainingStockCard />
        </div>
      )}

      {view === "all-menu" && !subView && (
        <div className="space-y-4">
          <BackButton onClick={handleBackToDashboard} />
          <Heading as="h2" className="text-admin-header-text text-center">All Restaurant Menu</Heading>
          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="p-6 hover:border-admin-accent transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <List size={24} className="text-green-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">Menus</Heading>
                  <p className="text-sm text-admin-muted">Manage menu dishes and stock assignments</p>
                </div>
              </div>
              <div className="mt-4">
                <MenuTableNav active="all" onSelect={handleMenuNavSelect} />
              </div>
            </Card>
            <Card
              className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
              onClick={() => setSubView("accompaniments")}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Beef size={24} className="text-green-600" />
                </div>
                <div>
                  <Heading as="h3" className="text-lg text-admin-header-text">Menu Accompaniments</Heading>
                  <p className="text-sm text-admin-muted">Manage side dishes served with menu items</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {view === "all-menu" && subView === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <BackButton onClick={handleBackFromSub} />
            <Button onClick={() => { setDialogEditId(null); setDialogOpen(true) }} className="px-6 py-6">
              <Plus size={16} className="mr-1" />
              Create Menu Item
            </Button>
          </div>
          <MenuTableNav active="all" onSelect={handleMenuNavSelect} />
          <AllMenuTable />
        </div>
      )}

      {view === "all-menu" && subView === "discontinued" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <BackButton onClick={handleBackFromSub} />
            <Button onClick={() => { setDialogEditId(null); setDialogOpen(true) }} className="px-6 py-6">
              <Plus size={16} className="mr-1" />
              Create Menu Item
            </Button>
          </div>
          <MenuTableNav active="discontinued" onSelect={handleMenuNavSelect} />
          <DiscontinuedMenusTable />
        </div>
      )}

      {view === "all-menu" && subView === "accompaniments" && (
        <div className="space-y-4">
          <BackButton onClick={handleBackFromSub} />
          <AccompanimentsTable />
        </div>
      )}

      <CreateMenuDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogEditId(null) }}
        editId={dialogEditId}
        onSaved={() => {}}
      />
    </div>
  )
}

export default Menu
