import { useState, useEffect } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { useAuthStore } from "../../stores/auth"
import { LayoutDashboard, Users, UtensilsCrossed, ChefHat, Warehouse, Receipt, LogOut, Settings, FileBarChart, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentShift, getShiftToClose, getPendingStockRequestCount, getPartialStockRequestCount, getCookedMenus, getLowStockCount, getRunningLowCount, getUnderproducedCookingCount } from "@/lib/api"

const allNavItems: {
  label: string
  path: string
  icon: typeof LayoutDashboard
  end?: boolean
  roles: User["role"][]
  accent?: boolean
  pending?: boolean
  partial?: boolean
  ready?: boolean
  lowstock?: boolean
  runninglow?: boolean
  underproduced?: boolean
}[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true, roles: ["admin", "manager", "cashier"] },
  { label: "Shift Management", path: "/admin/shift-management", icon: Clock, roles: ["admin", "manager"], accent: true },
  { label: "Procurement", path: "/admin/store", icon: Warehouse, roles: ["admin", "manager", "store"], pending: true, partial: true, lowstock: true },
  { label: "Kitchen", path: "/admin/kitchen", icon: ChefHat, roles: ["admin", "manager", "kitchen"], pending: true, partial: true, underproduced: true },
  { label: "Menu/Dispatch", path: "/admin/menu", icon: UtensilsCrossed, roles: ["admin", "manager"], ready: true, runninglow: true },
  { label: "Cashier", path: "/admin/cashier", icon: Receipt, roles: ["admin", "manager", "cashier"] },
  { label: "Reports", path: "/admin/reports", icon: FileBarChart, roles: ["admin", "manager"] },
  { label: "Users", path: "/admin/users", icon: Users, roles: ["admin", "manager"] },
  { label: "Settings", path: "/admin/settings", icon: Settings, roles: ["admin", "manager"] },
]

function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null)
  const [shiftType, setShiftType] = useState<string | null>(null)
  const [hasShiftToClose, setHasShiftToClose] = useState(false)
  const [currentShiftName, setCurrentShiftName] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [partialCount, setPartialCount] = useState(0)
  const [readyCount, setReadyCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [runningLowCount, setRunningLowCount] = useState(0)
  const [underproducedCount, setUnderproducedCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    function checkShift() {
      getCurrentShift()
        .then((shift) => {
          if (!cancelled) {
            setHasOpenShift(!!shift)
            setShiftType(shift?.type ?? null)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHasOpenShift(false)
            setShiftType(null)
          }
        })
    }
    function checkPending() {
      Promise.all([
        getPendingStockRequestCount(),
        getPartialStockRequestCount(),
        getCookedMenus(),
        getLowStockCount(),
        getRunningLowCount(),
        getUnderproducedCookingCount(),
      ])
        .then(([pending, partial, cooked, lowStock, runningLow, underproduced]) => {
          if (!cancelled) {
            setPendingCount(pending)
            setPartialCount(partial)
            setReadyCount(cooked.filter((item) => item.cooking.totalAvailable > 0).length)
            setLowStockCount(lowStock.count)
            setRunningLowCount(runningLow)
            setUnderproducedCount(underproduced.count)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPendingCount(0)
            setPartialCount(0)
            setReadyCount(0)
            setLowStockCount(0)
            setRunningLowCount(0)
            setUnderproducedCount(0)
          }
        })
    }
    function checkToClose() {
      getShiftToClose()
        .then((shift) => {
          if (!cancelled) setHasShiftToClose(!!shift)
        })
        .catch(() => {
          if (!cancelled) setHasShiftToClose(false)
        })
    }
    checkShift()
    checkPending()
    checkToClose()
    const interval = setInterval(() => {
      checkShift()
      checkPending()
      checkToClose()
    }, 5000)
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
                    ? hasShiftToClose
                      ? isActive
                        ? "bg-red-600/15 text-red-400 font-semibold"
                        : "text-red-500 hover:bg-red-600/10 hover:text-red-400 font-semibold"
                      : hasOpenShift
                        ? isActive
                          ? "bg-green-600/15 text-green-400 font-semibold"
                          : "text-green-500 hover:bg-green-600/10 hover:text-green-400 font-semibold"
                        : isActive
                          ? "bg-red-600/15 text-red-400 font-semibold"
                          : "text-red-500 hover:bg-red-600/10 hover:text-red-400 font-semibold"
                    : isActive
                      ? "bg-admin-accent text-admin-accent-text"
                      : "text-admin-sidebar-text hover:bg-admin-sidebar-hover"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
              {item.accent && (
                hasOpenShift && shiftType ? (
                  <span className={`ml-auto text-[11px] font-extrabold px-2 py-1 rounded-full shadow-sm border text-center ${
                    shiftType === "DAY"
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                      : shiftType === "NIGHT"
                        ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700"
                        : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                  }`}>
                    Shift: {shiftType}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-extrabold px-2 py-1 rounded-full shadow-sm border bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600 text-center">
                    No Shift
                  </span>
                )
              )}
              <span className="ml-auto inline-flex items-center gap-0.5">
                {item.pending && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1" title={`${pendingCount} pending`}>
                    {pendingCount}
                  </span>
                )}
                {item.partial && partialCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold px-1" title={`${partialCount} partial`}>
                    {partialCount}
                  </span>
                )}
                {item.ready && readyCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-green-500 text-white text-[9px] font-bold px-1" title={`${readyCount} ready`}>
                    {readyCount}
                  </span>
                )}
                {item.runninglow && runningLowCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1" title={`${runningLowCount} running low`}>
                    {runningLowCount}
                  </span>
                )}
                {item.lowstock && lowStockCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1" title={`${lowStockCount} low stock`}>
                    {lowStockCount}
                  </span>
                )}
                {item.underproduced && underproducedCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-red-600 text-white text-[9px] font-bold px-1" title={`${underproducedCount} underproduced`}>
                    {underproducedCount}
                  </span>
                )}
              </span>
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
