// TODO: Install socket.io-client (`npm install socket.io-client` in /web) and replace
// the polling fallback below with a real WebSocket connection.

import { useEffect, useRef, useState } from 'react'
import { Search, Plus, Printer, ClipboardList, ChefHat, Bike, CheckCircle, Clock, XCircle, CheckCheck } from 'lucide-react'

import { useQueryClient } from '@tanstack/react-query'

import { useOrders, useSendWaitingPayment } from '../hooks/useOrders'
import type { Order } from '../services/orders.service'
import { OrderDetailModal } from '../components/OrderDetailModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Delivery',
  PICKUP: 'Retirada',
  TABLE: 'Mesa',
}

const TYPE_COLORS: Record<string, string> = {
  DELIVERY: 'bg-blue-100 text-blue-700',
  PICKUP: 'bg-green-100 text-green-700',
  TABLE: 'bg-orange-100 text-orange-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'Pix',
  CASH_ON_DELIVERY: 'Dinheiro',
}

const NEXT_STATUS: Partial<Record<string, string>> = {
  PENDING: 'CONFIRMED',
  WAITING_PAYMENT_PROOF: 'CONFIRMED',
  WAITING_CONFIRMATION: 'CONFIRMED',
  // CONFIRMED is handled by "→" button → PREPARING
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'DISPATCHED',
  DISPATCHED: 'DELIVERED',
}

// TASK-125: Kanban v2 — 5 colunas (adicionada "Confirmado")
const ACTIVE_COLUMN_CONFIG = [
  {
    id: 'novos',
    label: 'Novos',
    statuses: ['PENDING', 'WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION'],
    color: 'border-yellow-200',
    headerColor: 'bg-yellow-50',
    icon: ClipboardList,
    iconColor: 'text-yellow-400',
    emptyIcon: '📋',
  },
  {
    id: 'confirmado',
    label: 'Confirmado',
    statuses: ['CONFIRMED'],
    color: 'border-purple-200',
    headerColor: 'bg-purple-50',
    icon: CheckCheck,
    iconColor: 'text-purple-400',
    emptyIcon: '✅',
  },
  {
    id: 'em_preparo',
    label: 'Em preparo',
    statuses: ['PREPARING'],
    color: 'border-blue-200',
    headerColor: 'bg-blue-50',
    icon: ChefHat,
    iconColor: 'text-blue-400',
    emptyIcon: '👨‍🍳',
  },
  {
    id: 'prontos',
    label: 'Prontos / saída',
    statuses: ['READY', 'DISPATCHED'],
    color: 'border-green-200',
    headerColor: 'bg-green-50',
    icon: Bike,
    iconColor: 'text-green-400',
    emptyIcon: '🚲',
  },
  {
    id: 'concluidos',
    label: 'Concluídos',
    statuses: ['DELIVERED'],
    color: 'border-gray-200',
    headerColor: 'bg-gray-50',
    icon: CheckCircle,
    iconColor: 'text-gray-400',
    emptyIcon: '📦',
  },
]

// ─── Sound helper ─────────────────────────────────────────────────────────────

function playBeep() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.6)
  } catch {
    // AudioContext not available
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onViewDetail,
  onAdvanceStatus,
  advancing,
  readonly,
}: {
  order: Order
  onViewDetail: (id: string) => void
  onAdvanceStatus: (id: string, status: string) => void
  advancing: boolean
  readonly?: boolean
}) {
  const nextStatus = NEXT_STATUS[order.status]
  const canAdvanceDirect = !readonly && nextStatus && !(order.status === 'READY' && order.type === 'DELIVERY')

  // TASK-124: Botão "Enviar Aguardando Pix" — só DELIVERY + PENDING
  const showWaitingPixButton =
    !readonly && order.status === 'PENDING' && order.type === 'DELIVERY'

  const sendWaitingPaymentMutation = useSendWaitingPayment()

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900">#{order.number}</span>
        <span className="text-xs text-gray-400">{formatTime(order.createdAt)}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[order.type] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {TYPE_LABELS[order.type] ?? order.type}
        </span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
        </span>
      </div>

      <div className="text-xs text-gray-600 truncate">
        {order.clientName ?? order.client?.name ?? order.clientWhatsapp}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
        </span>
        <span className="font-semibold text-gray-800">{formatCurrency(order.total)}</span>
      </div>

      {!readonly && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex gap-1">
            <button
              onClick={() => onViewDetail(order.id)}
              className="flex-1 rounded-md border border-gray-300 text-gray-700 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              Ver detalhes
            </button>
            {canAdvanceDirect && nextStatus && (
              <button
                onClick={() => onAdvanceStatus(order.id, nextStatus)}
                disabled={advancing}
                title={`Avançar para ${nextStatus}`}
                className="rounded-md bg-red-500 text-white px-2 py-1 text-xs font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                →
              </button>
            )}
            {order.status === 'READY' && order.type === 'DELIVERY' && (
              <button
                onClick={() => onViewDetail(order.id)}
                className="rounded-md bg-indigo-600 text-white px-2 py-1 text-xs font-bold hover:bg-indigo-700 transition-colors"
                title="Atribuir motoboy"
              >
                🛵
              </button>
            )}
          </div>

          {/* TASK-124: Botão Aguardando Pix (somente delivery + PENDING) */}
          {showWaitingPixButton && (
            <button
              onClick={() => sendWaitingPaymentMutation.mutate(order.id)}
              disabled={sendWaitingPaymentMutation.isPending}
              className="w-full flex items-center justify-center gap-1 rounded-md border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              title="Enviar mensagem de Aguardando Pagamento Pix"
            >
              <Clock className="w-3 h-3" />
              {sendWaitingPaymentMutation.isPending ? 'Enviando...' : 'Enviar Aguardando Pix'}
            </button>
          )}
        </div>
      )}

      {readonly && (
        <div className="pt-1">
          <button
            onClick={() => onViewDetail(order.id)}
            className="w-full rounded-md border border-gray-300 text-gray-700 py-1 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Ver detalhes
          </button>
        </div>
      )}
    </div>
  )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  orders,
  onViewDetail,
  onAdvanceStatus,
  advancing,
}: {
  col: (typeof ACTIVE_COLUMN_CONFIG)[number]
  orders: Order[]
  onViewDetail: (id: string) => void
  onAdvanceStatus: (id: string, status: string) => void
  advancing: string | null
}) {
  const Icon = col.icon
  const total = orders.reduce((acc, o) => acc + o.total, 0)
  const isFinished = col.id === 'concluidos'

  return (
    <div className={`flex-shrink-0 w-64 rounded-xl border ${col.color} flex flex-col max-h-full bg-white`}>
      <div className={`px-4 py-3 rounded-t-xl ${col.headerColor} border-b ${col.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${col.iconColor}`} />
            <span className="text-sm font-bold text-gray-700">{col.label}</span>
            {col.id === 'novos' && (
              <span className="text-xs bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
                Automático
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>
        {isFinished && orders.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Total: <span className="font-semibold text-gray-700">{formatCurrency(total)}</span>
          </p>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="text-4xl mb-2">{col.emptyIcon}</span>
            <p className="text-xs text-center">Nenhum pedido nesta etapa</p>
          </div>
        )}
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onViewDetail={onViewDetail}
            onAdvanceStatus={onAdvanceStatus}
            advancing={advancing === order.id}
          />
        ))}
      </div>
    </div>
  )
}

// ─── CancelledSection (TASK-126) ──────────────────────────────────────────────

function CancelledSection({
  orders,
  onViewDetail,
}: {
  orders: Order[]
  onViewDetail: (id: string) => void
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm font-bold text-gray-700">Cancelados</span>
        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum pedido cancelado hoje.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {orders.map((order) => (
            <div key={order.id} className="w-64 flex-shrink-0">
              <OrderCard
                order={order}
                onViewDetail={onViewDetail}
                onAdvanceStatus={() => void 0}
                advancing={false}
                readonly
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── OrdersPage ───────────────────────────────────────────────────────────────

type TypeFilter = 'todos' | 'DELIVERY' | 'TABLE' | 'PICKUP'
type PageTab = 'ativos' | 'cancelados'

export function OrdersPage() {
  const queryClient = useQueryClient()

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos')
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [printSales, setPrintSales] = useState(false)
  // TASK-126: Tab ativos / cancelados
  const [pageTab, setPageTab] = useState<PageTab>('ativos')

  const today = todayISO()
  const queryParams = {
    dateFrom: filterDate || today,
    limit: 200,
  }

  const { data, isLoading, isError, refetch } = useOrders(queryParams)

  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  const prevCountRef = useRef<number>(0)

  useEffect(() => {
    const interval = setInterval(() => {
      refetchRef.current()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const orders = data?.orders ?? []
    if (prevCountRef.current > 0 && orders.length > prevCountRef.current) {
      playBeep()
    }
    prevCountRef.current = orders.length
  }, [data?.orders])

  const allOrders = data?.orders ?? []

  // Filter by type
  const filteredByType =
    typeFilter === 'todos' ? allOrders : allOrders.filter((o) => o.type === typeFilter)

  // Filter by search
  const filteredOrders = search.trim()
    ? filteredByType.filter(
        (o) =>
          String(o.number).includes(search) ||
          (o.clientName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          o.clientWhatsapp.includes(search)
      )
    : filteredByType

  // TASK-126: Separar cancelados dos ativos
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'CANCELLED')
  const activeOrders = filteredOrders.filter((o) => o.status !== 'CANCELLED')

  // Group active orders by column
  const byColumn: Record<string, Order[]> = {}
  for (const col of ACTIVE_COLUMN_CONFIG) {
    byColumn[col.id] = activeOrders.filter((o) => col.statuses.includes(o.status))
  }

  function handleAdvanceStatus(id: string, status: string) {
    setAdvancingId(id)
    import('../services/orders.service').then(({ updateOrderStatus }) => {
      updateOrderStatus(id, status)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['order', id] })
        })
        .finally(() => setAdvancingId(null))
    })
  }

  const TYPE_TABS: { value: TypeFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'TABLE', label: 'Mesas' },
    { value: 'PICKUP', label: 'Retirada' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type tabs */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === t.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar pelo nome do cliente ou código do pedido"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Date */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          {/* Create order */}
          <button className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Criar pedido
          </button>
        </div>
      </div>

      {/* Banners */}
      <div className="px-6 pt-3 space-y-2 flex-shrink-0">
        {/* Impressão automática */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <Printer className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 flex-1">
            <span className="font-semibold">Impressão automática no seu computador,</span>{' '}
            <span className="underline cursor-pointer hover:text-blue-900">baixe o módulo</span>
          </p>
        </div>

        {/* Impressão de vendas + tabs Ativos / Cancelados */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
          <button
            onClick={() => setPrintSales((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
              printSales ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                printSales ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Impressão de vendas</span>
          </p>

          {/* TASK-126: Tabs Ativos / Cancelados */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setPageTab('ativos')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  pageTab === 'ativos'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ativos ({activeOrders.length})
              </button>
              <button
                onClick={() => setPageTab('cancelados')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  pageTab === 'cancelados'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Cancelados
                {cancelledOrders.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {cancelledOrders.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-x-auto px-6 py-4">
        {isLoading && (
          <p className="text-center text-sm text-gray-500 py-12">Carregando pedidos...</p>
        )}
        {isError && (
          <p className="text-center text-sm text-red-600 py-12">Erro ao carregar pedidos.</p>
        )}

        {!isLoading && !isError && pageTab === 'ativos' && (
          // TASK-125: Kanban com 5 colunas (inclui "Confirmado")
          <div className="flex gap-4 min-h-[60vh]" style={{ minWidth: 'max-content' }}>
            {ACTIVE_COLUMN_CONFIG.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                orders={byColumn[col.id] ?? []}
                onViewDetail={(id) => setSelectedOrderId(id)}
                onAdvanceStatus={handleAdvanceStatus}
                advancing={advancingId}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && pageTab === 'cancelados' && (
          // TASK-126: Seção de cancelados (readonly)
          <CancelledSection
            orders={cancelledOrders}
            onViewDetail={(id) => setSelectedOrderId(id)}
          />
        )}
      </main>

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          isOpen={Boolean(selectedOrderId)}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  )
}
