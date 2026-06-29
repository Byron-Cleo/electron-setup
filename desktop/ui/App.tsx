import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import WaiterPOS from "./pages/WaiterPOS"
import Store from "./pages/Store"
import Kitchen from "./pages/Kitchen"
import ProtectedRoute from "./components/ProtectedRoute"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/waiter/*"
          element={
            <ProtectedRoute role="waiter">
              <WaiterPOS />
            </ProtectedRoute>
          }
        />
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
