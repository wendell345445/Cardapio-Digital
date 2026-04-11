import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

interface OwnerGuardProps {
  children: React.ReactNode
}

export function OwnerGuard({ children }: OwnerGuardProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'OWNER') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Acesso restrito</h2>
          <p className="text-gray-500 mt-2 text-sm">Esta área é exclusiva para owners.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
