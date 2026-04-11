import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { fetchMotoboyOrders, markDelivered, type MotoboyOrder } from '../services/motoboy.service'

import { api } from '@/shared/lib/api'
import { useStoreSlug } from '@/hooks/useStoreSlug'

// ─── TASK-083: MotoboyPage ────────────────────────────────────────────────────

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getStoredToken(): string | null {
  return sessionStorage.getItem('token')
}

function isMotoboyToken(token: string | null): boolean {
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.role !== 'MOTOBOY') return false
    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) return false
    return true
  } catch {
    return false
  }
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const token: string = data.data?.token ?? data.token
      const storeId: string = data.data?.user?.storeId ?? data.user?.storeId ?? ''

      if (!isMotoboyToken(token)) {
        setError('Acesso negado. Esta área é exclusiva para motoboys.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('token', token)
      if (storeId) sessionStorage.setItem('storeId', storeId)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      onSuccess()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        'Erro ao fazer login. Verifique suas credenciais.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">🛵</div>
          <h1 className="text-2xl font-bold text-gray-900">Motoboy</h1>
          <p className="text-sm text-gray-500 mt-1">Acesse com suas credenciais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-base transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Address helpers ──────────────────────────────────────────────────────────

function formatAddress(
  address: MotoboyOrder['address']
): string {
  if (!address) return ''
  const parts = [address.street, address.number]
  if (address.complement) parts.push(address.complement)
  parts.push(address.neighborhood, address.city)
  return parts.join(', ')
}

function buildMapsUrl(address: MotoboyOrder['address']): string {
  const q = formatAddress(address)
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

function buildWazeUrl(address: MotoboyOrder['address']): string {
  const q = formatAddress(address)
  return `https://waze.com/ul?q=${encodeURIComponent(q)}`
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onDelivered,
}: {
  order: MotoboyOrder
  onDelivered: () => void
}) {
  const qc = useQueryClient()

  const deliverMutation = useMutation({
    mutationFn: () => markDelivered(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['motoboy-orders'] })
      onDelivered()
    },
  })

  function handleDeliver() {
    const confirmed = window.confirm(`Confirmar entrega do pedido #${order.number}?`)
    if (confirmed) {
      deliverMutation.mutate()
    }
  }

  const addressStr = formatAddress(order.address)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-gray-900 text-lg">
          #{order.number} — {order.clientName ?? 'Cliente'}
        </span>
        {order.dispatchedAt && (
          <span className="text-xs text-gray-500">Saiu {formatTime(order.dispatchedAt)}</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Client contact */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Telefone:</span>
          <a
            href={`tel:${order.clientWhatsapp}`}
            className="text-green-700 font-medium text-sm underline"
          >
            {order.clientWhatsapp}
          </a>
        </div>

        {/* Address + navigation */}
        {addressStr && (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Endereço:</span> {addressStr}
            </p>
            <div className="flex gap-2">
              <a
                href={buildMapsUrl(order.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
              >
                🗺️ Maps
              </a>
              <a
                href={buildWazeUrl(order.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
              >
                🧭 Waze
              </a>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-700">Itens:</p>
          {order.items.map((item, i) => (
            <div key={i} className="text-sm text-gray-600 pl-2 border-l-2 border-green-200">
              <span className="font-medium">
                {item.quantity}x {item.productName}
                {item.variationName && ` (${item.variationName})`}
              </span>
              {item.additionals.length > 0 && (
                <div className="text-xs text-gray-500 mt-0.5">
                  + {item.additionals.map((a) => a.name).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="text-xs text-amber-600 mt-0.5">Obs: {item.notes}</div>
              )}
            </div>
          ))}
        </div>

        {/* Total + payment */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="font-bold text-gray-900">{formatMoney(order.total)}</span>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {order.paymentMethod === 'PIX' ? '💳 Pix (pago)' : '💵 Cobrar na entrega'}
          </span>
        </div>

        {/* Deliver button — only for DISPATCHED in active tab */}
        {order.status === 'DISPATCHED' && (
          <button
            onClick={handleDeliver}
            disabled={deliverMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 text-white font-bold rounded-xl py-4 text-base transition-colors mt-2"
          >
            {deliverMutation.isPending ? 'Registrando...' : '✅ Marcar como Entregue'}
          </button>
        )}

        {deliverMutation.isError && (
          <p className="text-red-600 text-sm text-center">
            Erro ao marcar entrega. Tente novamente.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Motoboy Panel ────────────────────────────────────────────────────────────

function MotoboyPanel({ slug }: { slug: string | null }) {
  const [tab, setTab] = useState<'active' | 'history'>('active')

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['motoboy-orders', tab],
    queryFn: () => fetchMotoboyOrders(tab),
    refetchInterval: 10000,
  })

  function handleLogout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('storeId')
    delete api.defaults.headers.common['Authorization']
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div>
          <p className="text-xs opacity-75">Painel</p>
          <h1 className="font-bold text-lg leading-tight">Motoboy — {slug ?? 'Painel'}</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm bg-green-700 hover:bg-green-800 px-3 py-2 rounded-xl transition-colors"
        >
          Sair
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 sticky top-[68px] z-10">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'active'
              ? 'text-green-700 border-b-2 border-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🛵 Ativos
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'history'
              ? 'text-green-700 border-b-2 border-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 Histórico do Dia
        </button>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
            Erro ao carregar pedidos. Verifique sua conexão.
          </div>
        )}

        {!isLoading && !isError && orders?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">{tab === 'active' ? '🛵' : '📋'}</div>
            <p className="font-medium text-gray-500">
              {tab === 'active' ? 'Nenhum pedido ativo' : 'Nenhuma entrega hoje'}
            </p>
          </div>
        )}

        {orders?.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onDelivered={() => setTab('history')}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MotoboyPage() {
  const slug = useStoreSlug()
  const [authenticated, setAuthenticated] = useState(() => {
    const token = getStoredToken()
    if (isMotoboyToken(token)) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      return true
    }
    return false
  })

  if (!authenticated) {
    return <LoginForm onSuccess={() => setAuthenticated(true)} />
  }

  return <MotoboyPanel slug={slug} />
}
