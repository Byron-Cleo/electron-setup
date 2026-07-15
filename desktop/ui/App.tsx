import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import WaiterPOS from "./pages/waiterPos/WaiterPOS"
import WaiterLayout from "./pages/waiterPos/WaiterLayout"
import WaiterMenu from "./pages/waiterPos/WaiterMenu"
import Store from "./pages/Store"
import Kitchen from "./pages/Kitchen"
import AdminLayout from "./components/admin/AdminLayout"
import AdminUsers from "./pages/admin/Users"
import AdminMenu from "./pages/admin/Menu"
import AdminKitchen from "./pages/admin/Kitchen"
import AdminStore from "./pages/admin/Store"
import AdminCashier from "./pages/admin/Cashier"
import AdminManager from "./pages/admin/Manager"
import StockSupplyCategories from "./pages/admin/StockSupplyCategories"
import StockSupplyCategoryForm from "./pages/admin/StockSupplyCategoryForm"
import ProtectedRoute from "./components/ProtectedRoute"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="manager" element={<AdminManager />} />
          <Route path="manager/stock-supply-categories" element={<StockSupplyCategories />} />
          <Route path="manager/stock-supply-categories/new" element={<StockSupplyCategoryForm />} />
          <Route path="manager/stock-supply-categories/:id" element={<StockSupplyCategoryForm />} />
          <Route path="manager/stock-supplies" element={<div className="text-admin-header-text">Stock Supplies — Coming Soon</div>} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="kitchen" element={<AdminKitchen />} />
          <Route path="store" element={<AdminStore />} />
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
        <Route
          path="/store/*"
          element={
            <ProtectedRoute role="store">
              <Store />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kitchen/*"
          element={
            <ProtectedRoute role="kitchen">
              <Kitchen />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
