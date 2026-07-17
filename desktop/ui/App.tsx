import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
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
import AdminManager from "./pages/admin/Manager"
import StockSupplies from "./pages/admin/StockSupplies"
import StockSupplyForm from "./pages/admin/StockSupplyForm"
import ProtectedRoute from "./components/ProtectedRoute"
import { useAuthStore } from "./stores/auth"

function AdminIndex() {
  const user = useAuthStore((s) => s.user)
  if (user?.role === "store") return <Navigate to="/admin/store" replace />
  if (user?.role === "kitchen") return <Navigate to="/admin/kitchen" replace />
  return <Dashboard />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={["admin", "store", "kitchen"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminIndex />} />
          <Route path="settings" element={<AdminManager />} />
          <Route path="store" element={<AdminStore />} />
          <Route path="store/stock-supplies" element={<StockSupplies />} />
          <Route path="store/stock-supplies/new" element={<StockSupplyForm />} />
          <Route path="store/stock-supplies/:id" element={<StockSupplyForm />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="kitchen" element={<AdminKitchen />} />
          <Route path="cashier" element={<AdminCashier />} />
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
    </BrowserRouter>
  )
}

export default App
