import { useState } from "react"
import { UtensilsCrossed, List, Plus } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import CookedFoodTable from "@/components/menu/CookedFoodTable"
import AllMenuTable from "@/components/menu/AllMenuTable"
import CreateMenuDialog from "@/components/menu/CreateMenuDialog"

type MenuView = "dashboard" | "cooked-food" | "all-menu"

function Menu() {
  const [view, setView] = useState<MenuView>("dashboard")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogEditId, setDialogEditId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">Menu</Heading>

      {view === "dashboard" && (
        <div className="grid grid-cols-2 gap-6">
          <Card
            className="cursor-pointer rounded-xl p-6 bg-admin-card border border-admin-card-border hover:shadow-lg hover:-translate-y-0.5 transition-all"
            onClick={() => setView("cooked-food")}
          >
            <UtensilsCrossed size={32} className="text-admin-accent mb-3" />
            <Heading as="h2" className="text-lg text-admin-header-text">
              Today&apos;s Cooked Food
            </Heading>
            <p className="text-sm text-admin-muted mt-1">View cooked menu items</p>
          </Card>

          <Card
            className="cursor-pointer rounded-xl p-6 bg-admin-card border border-admin-card-border hover:shadow-lg hover:-translate-y-0.5 transition-all"
            onClick={() => setView("all-menu")}
          >
            <List size={32} className="text-admin-accent mb-3" />
            <Heading as="h2" className="text-lg text-admin-header-text">
              All Restaurant Menu
            </Heading>
            <p className="text-sm text-admin-muted mt-1">View all menu items</p>
          </Card>
        </div>
      )}

      {view === "cooked-food" && (
        <div className="space-y-4">
          <BackButton onClick={() => setView("dashboard")} />
          <CookedFoodTable />
        </div>
      )}

      {view === "all-menu" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <BackButton onClick={() => setView("dashboard")} />
            <Button onClick={() => { setDialogEditId(null); setDialogOpen(true) }}>
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
