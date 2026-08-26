import { useState, useEffect } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { useAuthStore } from "../../stores/auth"
import { LayoutDashboard, Users, UtensilsCrossed, ChefHat, Warehouse, Receipt, LogOut, Settings, FileBarChart, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentShift, getPendingStockRequestCount } from "@/lib/api"

const allNavItems: {
  label: string
  path: string
  icon: typeof LayoutDashboard
  end?: boolean
  roles: User["role"][]
  accent?: boolean
  pending?: boolean
}[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true, roles: ["admin", "manager"] },
  { label: "Store/Procurement", path: "/admin/store", icon: Warehouse, roles: ["admin", "manager", "store"], pending: true },
  { label: "Kitchen", path: "/admin/kitchen", icon: ChefHat, roles: ["admin", "manager", "kitchen"] },
  { label: "Menu", path: "/admin/menu", icon: UtensilsCrossed, roles: ["admin", "manager"] },
  { label: "Cashier", path: "/admin/cashier", icon: Receipt, roles: ["admin", "manager"] },
  { label: "Shift Management", path: "/admin/shift-management", icon: Clock, roles: ["admin", "manager"], accent: true },
  { label: "Reports", path: "/admin/reports", icon: FileBarChart, roles: ["admin", "manager"] },
  { label: "Users", path: "/admin/users", icon: Users, roles: ["admin", "manager"] },
  { label: "Settings", path: "/admin/settings", icon: Settings, roles: ["admin", "manager"] },
]

function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    function checkShift() {
      getCurrentShift()
        .then((shift) => {
          if (!cancelled) setHasOpenShift(!!shift)
        })
        .catch(() => {
          if (!cancelled) setHasOpenShift(false)
        })
    }
    function checkPending() {
      getPendingStockRequestCount()
        .then((count) => {
          if (!cancelled) setPendingCount(count)
        })
        .catch(() => {
          if (!cancelled) setPendingCount(0)
        })
    }
    checkShift()
    checkPending()
    const interval = setInterval(() => {
      checkShift()
      checkPending()
    }, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const navItems = allNavItems.filter((item) =>
    item.roles.includes(user?.role as User["role"])
  )

  return (
    <div className="h-screen flex overflow-hidden bg-admin-content">
      <aside className="w-60 bg-admin-sidebar flex flex-col shrink-0 border-r border-admin-card-border print:hidden">
        <div className="flex flex-col items-center gap-1 pt-4 pb-2 px-4">
          <img src="./images/logo/eraeva-logo.png" alt="Eraeva Logo" className="h-20 w-20 object-contain" />
          <span className="text-xs font-semibold text-admin-header-text text-center leading-tight">Eraeva<br />Catering Services</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  item.accent
                    ? hasOpenShift
                      ? isActive
                        ? "bg-green-600/15 text-green-400 font-semibold"
                        : "text-green-500 hover:bg-green-600/10 hover:text-green-400 font-semibold"
                      : isActive
                        ? "bg-red-600/15 text-red-400 font-semibold"
                        : "text-red-500 hover:bg-red-600/10 hover:text-red-400 font-semibold"
                    : item.pending && pendingCount > 0
                      ? isActive
                        ? "bg-amber-500/15 text-amber-400 font-semibold"
                        : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 font-semibold"
                      : isActive
                        ? "bg-admin-accent text-admin-accent-text"
                        : "text-admin-sidebar-text hover:bg-admin-sidebar-hover"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
              {item.pending && pendingCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1">
        <header className="h-15 bg-admin-header text-admin-header-text flex items-center justify-end gap-4 px-6 shrink-0 border-b border-admin-card-border print:hidden">
          <div className="h-8 w-8 rounded-full bg-admin-accent/10 flex items-center justify-center text-admin-accent text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="text-sm font-medium">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut size={18} />
            </Button>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>

        <footer className="h-10 bg-admin-content text-admin-muted flex items-center justify-center text-xs shrink-0 border-t border-admin-card-border print:hidden">
          &copy; {new Date().getFullYear()} Eraeva POS. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

export default AdminLayout
