import { useState } from "react"
import { UtensilsCrossed, Plus } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import CookedFoodTable from "@/components/menu/CookedFoodTable"
import MenuForm from "@/components/MenuForm"

type MenuTab = "cooked-food" | "create"

function Menu() {
  const [tab, setTab] = useState<MenuTab>("cooked-food")
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleSaved() {
    setTab("cooked-food")
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">Menu</Heading>

      <div className="flex gap-1 border-b border-admin-card-border">
        {([
          { key: "cooked-food" as const, label: "Cooked Food", icon: UtensilsCrossed },
          { key: "create" as const, label: editingId ? "Edit Menu Item" : "Create Menu Item", icon: Plus },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key === "create") setEditingId(null) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-b-2 border-admin-accent text-admin-accent"
                : "text-admin-muted hover:text-admin-header-text"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "cooked-food" && <CookedFoodTable />}

      {tab === "create" && (
        <MenuForm
          editId={editingId}
          onSaved={handleSaved}
          onCancel={() => { setTab("cooked-food"); setEditingId(null) }}
        />
      )}
    </div>
  )
}

export default Menu
