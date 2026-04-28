// TODO: Install socket.io-client (`npm install socket.io-client` in /web) and replace
// the polling fallback below with a real WebSocket connection.

import { useEffect, useRef, useState } from 'react'
import { Search, Plus, Printer, ClipboardList, ChefHat, Bike, CheckCircle, XCircle, CheckCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

import { useOrders, usePrintOrder } from '../hooks/useOrders'
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
  CREDIT_CARD: 'Cartão crédito',
  CASH_ON_DELIVERY: 'Dinheiro',
  CREDIT_ON_DELIVERY: 'Crédito na entrega',
  DEBIT_ON_DELIVERY: 'Débito na entrega',
  PIX_ON_DELIVERY: 'Pix na entrega',
  PENDING: 'Na comanda',
}

const NEXT_STATUS: Partial<Record<string, string>> = {
  WAITING_PAYMENT_PROOF: 'CONFIRMED',
  WAITING_CONFIRMATION: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'DISPATCHED',
  DISPATCHED: 'DELIVERED',
}

/** Backend-validated transitions — used to validate drag-and-drop */
const VALID_TRANSITIONS: Record<string, string[]> = {
  WAITING_PAYMENT_PROOF: ['CONFIRMED', 'CANCELLED'],
  WAITING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DISPATCHED', 'DELIVERED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

/**
 * Maps each Kanban column to the target status when an order is dropped there.
 * Coluna "novos" não recebe drops (não há transição válida de outras colunas pra ela).
 */
const COLUMN_DROP_STATUS: Record<string, string> = {
  novos: 'WAITING_CONFIRMATION',
  confirmado: 'CONFIRMED',
  em_preparo: 'PREPARING',
  prontos: 'READY',
  concluidos: 'DELIVERED',
}

function canTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return false
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false
}

/**
 * Mover de READY → DELIVERED num pedido de entrega sem motoboy atribuído pula
 * o fluxo esperado (Pronto → atribuir motoboy → Saiu → Entregue). O botão "→"
 * no card já bloqueia essa transição direta (OrderCard.canAdvanceDirect); o
 * drag-and-drop precisa pedir confirmação pra evitar conclusão acidental
 * sem histórico de quem levou.
 */
export function requiresMotoboyConfirmation(
  order: Pick<Order, 'status' | 'type' | 'motoboyId'>,
  targetStatus: string
): boolean {
  return (
    order.status === 'READY' &&
    order.type === 'DELIVERY' &&
    targetStatus === 'DELIVERED' &&
    !order.motoboyId
  )
}

// TASK-125: Kanban v2 — 5 colunas (adicionada "Confirmado")
const ACTIVE_COLUMN_CONFIG = [
  {
    id: 'novos',
    label: 'Novos',
    // Pedidos nascem em WAITING_PAYMENT_PROOF (PIX) ou WAITING_CONFIRMATION (demais).
    // Status PENDING foi descontinuado.
    statuses: ['WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION'],
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

function dayRangeISO(dateStr?: string): { from: string; to: string } {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
  const from = new Date(base)
  from.setHours(0, 0, 0, 0)
  const to = new Date(base)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

function todayInputValue(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── DraggableOrderCard (wrapper) ─────────────────────────────────────────────

function DraggableOrderCard({
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled: readonly,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-30' : ''}
    >
      <OrderCard
        order={order}
        onViewDetail={onViewDetail}
        onAdvanceStatus={onAdvanceStatus}
        advancing={advancing}
        readonly={readonly}
      />
    </div>
  )
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
  // A-053: DISPATCHED + PIX deve usar "Pix Pago" (não pode ir para DELIVERED sem confirmar pgto).
  const isPixDispatched = order.status === 'DISPATCHED' && order.paymentMethod === 'PIX'
  const canAdvanceDirect = !readonly && nextStatus
    && !(order.status === 'READY' && order.type === 'DELIVERY')
    && !isPixDispatched

  // A-053: Botão "Pix Pago" — só DISPATCHED + PIX (motoboy retornou)
  const showPixPagoButton = !readonly && isPixDispatched

  const printOrderMutation = usePrintOrder()

  return (
    <div className={`bg-white rounded-lg border p-3 shadow-sm space-y-2 text-sm ${order.deliveryIssueReason ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900">#{order.number}</span>
        <span className="text-xs text-gray-400">{formatTime(order.createdAt)}</span>
      </div>

      {order.deliveryIssueReason && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md px-2 py-1.5">
          <span className="font-semibold">Devolvido:</span> {order.deliveryIssueReason}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[order.type] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {TYPE_LABELS[order.type] ?? order.type}
        </span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
        </span>
        {order.status === 'WAITING_PAYMENT_PROOF' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
            Aguard. Pix
          </span>
        )}
        {order.paymentMethod === 'PENDING' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
            Pagar na comanda
          </span>
        )}
        {order.paymentMethod !== 'PIX' && order.paymentMethod !== 'PENDING' && order.paymentMethod !== 'CREDIT_CARD' && order.status !== 'WAITING_PAYMENT_PROOF' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700">
            Pagar na entrega
          </span>
        )}
        {order.status === 'DELIVERED' && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
            Pago
          </span>
        )}
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
            <button
              onClick={() => printOrderMutation.mutate({ id: order.id, orderNumber: order.number })}
              disabled={printOrderMutation.isPending}
              title="Imprimir pedido"
              className="rounded-md border border-blue-300 text-blue-600 px-2 py-1 text-xs hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
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

          {/* A-053: Botão "Pix Pago" — motoboy retornou, confirmar pagamento */}
          {showPixPagoButton && (
            <button
              onClick={() => onAdvanceStatus(order.id, 'DELIVERED')}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-1 rounded-md border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
              title="Motoboy retornou — confirmar que o Pix foi recebido"
            >
              <CheckCircle className="w-3 h-3" />
              {advancing ? 'Confirmando...' : 'Confirmar Pix recebido'}
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
  const { isOver, setNodeRef } = useDroppable({ id: col.id })
  const Icon = col.icon
  const total = orders.reduce((acc, o) => acc + o.total, 0)
  const isFinished = col.id === 'concluidos'

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 rounded-xl border ${col.color} flex flex-col max-h-full transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-white'
      }`}
    >
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
          <DraggableOrderCard
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
  const [filterDate, setFilterDate] = useState(todayInputValue)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [printSales, setPrintSales] = useState(false)
  // TASK-126: Tab ativos / cancelados
  const [pageTab, setPageTab] = useState<PageTab>('ativos')
  // A-045: Drag-and-drop state
  const [draggingOrder, setDraggingOrder] = useState<Order | null>(null)

  // dnd-kit sensor: require 8px movement before drag starts (avoids accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { from: dateFrom, to: dateTo } = dayRangeISO(filterDate || undefined)
  const queryParams = {
    dateFrom,
    dateTo,
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

  // A-045: Drag-and-drop handlers
  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as Order | undefined
    setDraggingOrder(order ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingOrder(null)
    const { active, over } = event
    if (!over) return

    const order = active.data.current?.order as Order | undefined
    if (!order) return

    const targetColumnId = over.id as string
    const targetStatus = COLUMN_DROP_STATUS[targetColumnId]
    if (!targetStatus) return

    // Skip if order is already in that status (or column contains it)
    const targetCol = ACTIVE_COLUMN_CONFIG.find((c) => c.id === targetColumnId)
    if (targetCol?.statuses.includes(order.status)) return

    // Validate transition
    if (!canTransition(order.status, targetStatus)) return

    // A-053: DISPATCHED + PIX não pode ir para DELIVERED via drag (deve usar "Pix Pago")
    if (
      order.paymentMethod === 'PIX' &&
      order.status === 'DISPATCHED' &&
      targetStatus === 'DELIVERED'
    ) return

    if (requiresMotoboyConfirmation(order, targetStatus)) {
      const confirmed = window.confirm(
        'Este pedido de entrega não tem um motoboy atribuído. ' +
        'Marcar como Entregue mesmo assim?'
      )
      if (!confirmed) return
    }

    handleAdvanceStatus(order.id, targetStatus)
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
          // TASK-125 + A-045: Kanban com 5 colunas + drag-and-drop
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
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
            <DragOverlay>
              {draggingOrder && (
                <div className="w-64 opacity-90 rotate-2 shadow-xl">
                  <OrderCard
                    order={draggingOrder}
                    onViewDetail={() => void 0}
                    onAdvanceStatus={() => void 0}
                    advancing={false}
                    readonly
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
