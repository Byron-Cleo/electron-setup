import { Navigate } from "react-router-dom"
import { useAuthStore } from "../stores/auth"

interface Props {
  role: User["role"]
  children: React.ReactNode
}

function ProtectedRoute({ role, children }: Props) {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
