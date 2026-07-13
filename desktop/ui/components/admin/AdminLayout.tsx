import { NavLink, Outlet } from "react-router-dom"
import { useAuthStore } from "../../stores/auth"
import { LayoutDashboard, Users, UtensilsCrossed, ChefHat, Warehouse, Receipt, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true },
  { label: "Procurement", path: "/admin/store", icon: Warehouse },
  { label: "Kitchen", path: "/admin/kitchen", icon: ChefHat },
  { label: "Menu", path: "/admin/menu", icon: UtensilsCrossed },
  { label: "Cashier", path: "/admin/cashier", icon: Receipt },
  { label: "Users", path: "/admin/users", icon: Users },
]

function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="min-h-screen flex bg-admin-content">
      <aside className="w-60 bg-admin-sidebar flex flex-col shrink-0 border-r border-admin-card-border">
        <div className="flex flex-col items-center gap-1 pt-4 pb-2 px-4">
          <img src="/images/logo/eraeva-logo.png" alt="Eraeva Logo" className="h-20 w-20 object-contain" />
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
                  isActive
                    ? "bg-admin-accent text-admin-accent-text"
                    : "text-admin-sidebar-text hover:bg-admin-sidebar-hover"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1">
        <header className="h-15 bg-admin-header text-admin-header-text flex items-center justify-end gap-4 px-6 shrink-0 border-b border-admin-card-border">
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

        <footer className="h-10 bg-admin-content text-admin-muted flex items-center justify-center text-xs shrink-0 border-t border-admin-card-border">
          &copy; {new Date().getFullYear()} Eraeva POS. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

export default AdminLayout
