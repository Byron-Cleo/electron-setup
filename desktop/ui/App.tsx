import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import Login from "./pages/Login"
import ServerRecovery from "./pages/ServerRecovery"
import Dashboard from "./pages/Dashboard"
import WaiterPOS from "./pages/waiterPos/WaiterPOS"
import WaiterLayout from "./pages/waiterPos/WaiterLayout"
import WaiterMenu from "./pages/waiterPos/WaiterMenu"
import AdminLayout from "./components/admin/AdminLayout"
import AdminUsers from "./pages/admin/Users"
import AdminMenu from "./pages/admin/Menu"
import AdminKitchen from "./pages/admin/Kitchen"
import AdminStore from "./pages/admin/Store"
import AdminCashier from "./pages/admin/Cashier"
import AdminReports from "./pages/admin/Reports"
import AdminManager from "./pages/admin/Manager"
import AdminShiftManagement from "./pages/admin/ShiftManagement"
import StockSupplies from "./pages/admin/StockSupplies"
import StockSupplyForm from "./pages/admin/StockSupplyForm"
import ProtectedRoute from "./components/ProtectedRoute"
import { useAuthStore } from "./stores/auth"
import {
  getServerApiBase,
  getServerConfig,
  saveServerConfig,
  testServerConnection,
} from "./lib/api"

function AdminIndex() {
  const user = useAuthStore((s) => s.user)
  if (user?.role === "store") return <Navigate to="/admin/store" replace />
  if (user?.role === "kitchen") return <Navigate to="/admin/kitchen" replace />
  return <Dashboard />
}

function ConnectionGate() {
  const [state, setState] = useState<"checking" | "online" | "offline">("checking")
  const [apiBase, setApiBase] = useState("")

  async function check() {
    try {
      const [status, base] = await Promise.all([testServerConnection(), getServerApiBase()])
      setApiBase(base)
      setState(status.online === false ? "offline" : "online")
    } catch {
      setState("offline")
    }
  }

  function handleRetry() {
    setState("checking")
    void check()
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([testServerConnection(), getServerApiBase()])
      .then(([status, base]) => {
        if (cancelled) return
        setApiBase(base)
        setState(status.online === false ? "offline" : "online")
      })
      .catch(() => {
        if (!cancelled) setState("offline")
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleReconnect(serverUrl: string) {
    const previous = await getServerConfig()
    await saveServerConfig({ serverUrl })
    const [status, base] = await Promise.all([testServerConnection(), getServerApiBase()])
    setApiBase(base)
    if (status.online !== true) {
      await saveServerConfig(previous)
      throw new Error(
        status.reason && !/failed to parse|fetch|networkerror|load failed/i.test(status.reason)
          ? status.reason
          : "Could not reach the server at that address. Check the IP and try again.",
      )
    }
    setState("online")
  }

  if (state === "checking") {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-[#F5EDE0] text-brand-ebony font-sans gap-4">
        <img
          src="./images/logo/eraeva-logo.png"
          alt="Eraeva Logo"
          className="w-24 h-24 object-contain rounded-2xl drop-shadow-[0_4px_20px_rgba(181,103,37,0.3)]"
        />
        <Loader2 className="h-6 w-6 animate-spin text-brand-red" />
      </div>
    )
  }

  if (state === "offline") {
    return <ServerRecovery apiBase={apiBase} onReconnect={handleReconnect} onRetry={handleRetry} />
  }

  return <Login />
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<ConnectionGate />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={["admin", "manager", "store", "kitchen"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminIndex />} />
          <Route path="settings" element={
            <ProtectedRoute role={["admin", "manager"]}>
              <AdminManager />
            </ProtectedRoute>
          } />
          <Route path="shift-management" element={
            <ProtectedRoute role={["admin", "manager"]}>
              <AdminShiftManagement />
            </ProtectedRoute>
          } />
          <Route path="store" element={<AdminStore />} />
          <Route path="store/stock-supplies" element={<StockSupplies />} />
          <Route path="store/stock-supplies/new" element={<StockSupplyForm />} />
          <Route path="store/stock-supplies/:id" element={<StockSupplyForm />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="kitchen" element={
            <ProtectedRoute role={["admin", "manager", "kitchen"]}>
              <AdminKitchen />
            </ProtectedRoute>
          } />
          <Route path="cashier" element={<AdminCashier />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute role={["admin", "manager"]}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route
          path="/waiter"
          element={
            <ProtectedRoute role="waiter">
              <WaiterLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<WaiterPOS />} />
          <Route path="menu/:mealPeriod" element={<WaiterMenu />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
