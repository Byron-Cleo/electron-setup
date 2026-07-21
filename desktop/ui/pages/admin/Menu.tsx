import { useState, useRef, useCallback } from "react"
import { UtensilsCrossed, Plus } from "lucide-react"
import { Heading } from "@/components/ui/heading"
import CookedFoodTable from "@/components/menu/CookedFoodTable"
import AssignmentModal from "@/components/menu/AssignmentModal"
import MenuForm from "@/components/MenuForm"

type MenuTab = "cooked-food" | "create"

interface CookedItemForAssign {
  stockSupplyId: string
  stockSupplyName: string
  cookedDate: string
  totalProduced: number
  totalAssigned: number
  totalAvailable: number
  assignments: {
    id: string
    menuId: string
    menuName: string
    quantityPlates: number
  }[]
}

function Menu() {
  const [tab, setTab] = useState<MenuTab>("cooked-food")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assignItem, setAssignItem] = useState<CookedItemForAssign | null>(null)
  const refreshRef = useRef<() => void>(() => {})

  function handleSaved() {
    setTab("cooked-food")
    setEditingId(null)
  }

  const handleAssign = useCallback((item: CookedItemForAssign) => {
    setAssignItem(item)
  }, [])

  const handleAssignRefresh = useCallback(() => {
    refreshRef.current()
  }, [])

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

      {tab === "cooked-food" && (
        <CookedFoodTable
          onAssign={handleAssign}
          refreshRef={refreshRef}
        />
      )}

      {tab === "create" && (
        <MenuForm
          editId={editingId}
          onSaved={handleSaved}
          onCancel={() => { setTab("cooked-food"); setEditingId(null) }}
        />
      )}

      <AssignmentModal
        open={assignItem !== null}
        onClose={() => setAssignItem(null)}
        cookedItem={assignItem}
        onRefresh={handleAssignRefresh}
      />
    </div>
  )
}

export default Menu
