import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { logout as logoutService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useStores } from '../hooks/useOwnerStores'
import { StoreList } from '../components/StoreList'
import type { StoreStatus } from '../services/owner.service'

const STATUS_OPTIONS: { value: StoreStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<StoreStatus | ''>('')
  const { data, isLoading, isError } = useStores(statusFilter || undefined)
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (refreshToken) {
      await logoutService(refreshToken).catch(() => {})
    }
    logout()
    void navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Super Cardápio — Owner</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/owner/stores/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Nova loja
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* MRR card */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">MRR estimado</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                R$ {data.mrr.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Total de lojas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.stores.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Lojas ativas</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {data.stores.filter((s) => s.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">Filtrar:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {isLoading && <p className="text-sm text-gray-500">Carregando lojas...</p>}
        {isError && <p className="text-sm text-red-600">Erro ao carregar lojas.</p>}
        {data && <StoreList stores={data.stores} />}
      </main>
    </div>
  )
}
