import { Link, Navigate } from 'react-router-dom'

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
    const homeByRole =
      user.role === 'OWNER' ? '/owner/dashboard' : user.role === 'MOTOBOY' ? '/motoboy' : '/login'

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900">Acesso não autorizado</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Esta área é exclusiva para administradores de loja. Seu perfil ({user.role}) não tem
            permissão para acessá-la.
          </p>
          <Link
            to={homeByRole}
            className="inline-block mt-4 px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Voltar para minha área
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
