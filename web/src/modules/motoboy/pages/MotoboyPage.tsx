import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { SiGooglemaps, SiWaze } from 'react-icons/si'

import { useAuthConfig } from '../../auth/hooks/useAuthConfig'
import { fetchMotoboyOrders, markDelivered, reportDeliveryProblem, type MotoboyOrder } from '../services/motoboy.service'

import { PasswordInput } from '@/shared/components/PasswordInput'
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

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

function LoginForm({ onSuccess, slug }: { onSuccess: () => void; slug: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(oauthError)
      const next = new URLSearchParams(searchParams)
      next.delete('error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: authConfig, isLoading: isAuthConfigLoading } = useAuthConfig()
  const googleEnabled = !!authConfig?.providers.google
  const showGoogle = !isAuthConfigLoading && googleEnabled

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password, scope: 'motoboy' })
      const token: string = data.data?.accessToken ?? data.accessToken ?? ''
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

  function handleGoogleLogin() {
    const returnTo = slug ? `/${slug}/motoboy` : '/motoboy'
    sessionStorage.setItem('oauth_return_to', returnTo)
    sessionStorage.setItem('oauth_error_return_to', returnTo)
    window.location.href = `${API_BASE_URL}/api/v1/auth/google?scope=motoboy`
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
            <PasswordInput
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

        {showGoogle && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">ou</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl py-3 text-base transition-colors"
              aria-label="Entrar com Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Entrar com Google
            </button>
          </>
        )}
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

// M-010: rótulo do pagamento com status (pago/cobrar)
// PIX e CREDIT_CARD = pago online (admin já confirmou para liberar DISPATCHED).
// *_ON_DELIVERY = cobrar na entrega.
// PENDING = forma ainda não definida — admin precisa informar.
function describePayment(method: string): { label: string; tone: 'paid' | 'cash' | 'pending' } {
  switch (method) {
    case 'PIX':
      return { label: '💳 Pix — pago', tone: 'paid' }
    case 'CREDIT_CARD':
      return { label: '💳 Cartão online — pago', tone: 'paid' }
    case 'CASH_ON_DELIVERY':
      return { label: '💵 Dinheiro — cobrar na entrega', tone: 'cash' }
    case 'CREDIT_ON_DELIVERY':
      return { label: '💳 Crédito na maquininha — cobrar', tone: 'cash' }
    case 'DEBIT_ON_DELIVERY':
      return { label: '💳 Débito na maquininha — cobrar', tone: 'cash' }
    case 'PIX_ON_DELIVERY':
      return { label: '💳 Pix na entrega — cobrar', tone: 'cash' }
    case 'PENDING':
      return { label: '⏳ Pagamento pendente', tone: 'pending' }
    default:
      return { label: method, tone: 'pending' }
  }
}

// ─── Delivery Problem Reasons ─────────────────────────────────────────────────

const DELIVERY_PROBLEM_REASONS = [
  'Cliente ausente',
  'Endereço não encontrado',
  'Cliente recusou o pedido',
  'Endereço incorreto / incompleto',
  'Problema no pedido (itens errados)',
  'Outro motivo',
]

// ─── Report Problem Modal ─────────────────────────────────────────────────────

function ReportProblemModal({
  order,
  onClose,
  onSuccess,
}: {
  order: MotoboyOrder
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (reason: string) => reportDeliveryProblem(order.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['motoboy-orders'] })
      onSuccess()
    },
  })

  const finalReason = selectedReason === 'Outro motivo' ? customReason.trim() : selectedReason
  const canSubmit = !!finalReason && !mutation.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Reportar problema</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pedido #{order.number}</p>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">Qual o motivo?</p>
          {DELIVERY_PROBLEM_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                selectedReason === reason
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {reason}
            </button>
          ))}

          {selectedReason === 'Outro motivo' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Descreva o motivo..."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          )}

          {mutation.isError && (
            <p className="text-red-600 text-sm text-center">
              Erro ao reportar problema. Tente novamente.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 border border-gray-300 text-gray-700 font-medium rounded-xl py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => finalReason && mutation.mutate(finalReason)}
            disabled={!canSubmit}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-colors"
          >
            {mutation.isPending ? 'Enviando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [showProblemModal, setShowProblemModal] = useState(false)

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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">Telefone:</span>
            {order.clientWhatsapp ? (
              <span className="text-gray-900 font-medium text-sm">{order.clientWhatsapp}</span>
            ) : (
              <span className="text-gray-400 text-sm">não informado</span>
            )}
          </div>
          {order.clientWhatsapp && (
            <div className="flex gap-2">
              <a
                href={`tel:${order.clientWhatsapp}`}
                className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
                aria-label="Ligar para o cliente"
              >
                📞 Ligar
              </a>
              <a
                href={`https://wa.me/${order.clientWhatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
                aria-label="Abrir WhatsApp do cliente"
              >
                💬 WhatsApp
              </a>
            </div>
          )}
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
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
              >
                <SiGooglemaps className="w-4 h-4" style={{ color: '#4285F4' }} aria-hidden />
                Maps
              </a>
              <a
                href={buildWazeUrl(order.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium rounded-xl py-2.5 text-sm transition-colors"
              >
                <SiWaze className="w-4 h-4" style={{ color: '#33CCFF' }} aria-hidden />
                Waze
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
        {(() => {
          const payment = describePayment(order.paymentMethod)
          const toneClass =
            payment.tone === 'paid'
              ? 'bg-green-50 text-green-700'
              : payment.tone === 'cash'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-100 text-gray-600'
          return (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
              <span className="font-bold text-gray-900">{formatMoney(order.total)}</span>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${toneClass}`}>
                {payment.label}
              </span>
            </div>
          )
        })()}

        {/* Action buttons — only for DISPATCHED in active tab */}
        {order.status === 'DISPATCHED' && (
          <div className="space-y-2 mt-2">
            <button
              onClick={handleDeliver}
              disabled={deliverMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 text-white font-bold rounded-xl py-4 text-base transition-colors"
            >
              {deliverMutation.isPending ? 'Registrando...' : 'Marcar como Entregue'}
            </button>
            <button
              onClick={() => setShowProblemModal(true)}
              disabled={deliverMutation.isPending}
              className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-60 font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              Nao consegui entregar
            </button>
          </div>
        )}

        {deliverMutation.isError && (
          <p className="text-red-600 text-sm text-center">
            Erro ao marcar entrega. Tente novamente.
          </p>
        )}
      </div>

      {showProblemModal && (
        <ReportProblemModal
          order={order}
          onClose={() => setShowProblemModal(false)}
          onSuccess={() => setShowProblemModal(false)}
        />
      )}
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
  const hostSlug = useStoreSlug()
  const { slug: pathSlug } = useParams<{ slug: string }>()
  const slug = hostSlug ?? pathSlug ?? null
  const [authenticated, setAuthenticated] = useState(() => {
    const token = getStoredToken()
    if (isMotoboyToken(token)) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      return true
    }
    return false
  })

  if (!authenticated) {
    return <LoginForm onSuccess={() => setAuthenticated(true)} slug={slug} />
  }

  return <MotoboyPanel slug={slug} />
}
