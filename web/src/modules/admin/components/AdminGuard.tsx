import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
