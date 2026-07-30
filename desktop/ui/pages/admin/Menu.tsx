import { useState, useEffect } from "react"
import { UtensilsCrossed, List, Plus } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import CookedFoodTable from "@/components/menu/CookedFoodTable"
import AllMenuTable from "@/components/menu/AllMenuTable"
import CreateMenuDialog from "@/components/menu/CreateMenuDialog"
import { getCookedMenus } from "@/lib/api"

type MenuView = "dashboard" | "cooked-food" | "all-menu"

function Menu() {
  const [view, setView] = useState<MenuView>("dashboard")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogEditId, setDialogEditId] = useState<string | null>(null)
  const [readyCount, setReadyCount] = useState(0)

  function loadReadyCount() {
    getCookedMenus()
      .then((items) => setReadyCount(items.filter((i) => i.cooking.totalAvailable > 0).length))
      .catch(() => {})
  }

  useEffect(() => {
    loadReadyCount()
  }, [])

  function handleBackToDashboard() {
    setView("dashboard")
    loadReadyCount()
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">Menu</Heading>

      {view === "dashboard" && (
        <div className="grid grid-cols-2 gap-6">
          <Card
            className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
            onClick={() => setView("cooked-food")}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UtensilsCrossed size={24} className="text-green-600" />
              </div>
              <div>
                <Heading as="h3" className="text-lg text-admin-header-text">
                  Today&apos;s Cooked Food
                </Heading>
                <div className="flex items-center gap-2 mt-1">
                  {readyCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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
            onClick={() => setView("all-menu")}
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

      {view === "cooked-food" && (
        <div className="space-y-4">
          <BackButton onClick={handleBackToDashboard} />
          <CookedFoodTable />
        </div>
      )}

      {view === "all-menu" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <BackButton onClick={() => setView("dashboard")} />
            <Button onClick={() => { setDialogEditId(null); setDialogOpen(true) }} className="px-6 py-6">
              <Plus size={16} className="mr-1" />
              Create Menu Item
            </Button>
          </div>
          <AllMenuTable />
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
