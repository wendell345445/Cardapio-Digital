import { useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchOrders } from '../services/orders.service'
import type { Order, ListOrdersParams } from '../services/orders.service'
import { OrderDetailModal } from '../components/OrderDetailModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Novo',
  WAITING_PAYMENT_PROOF: 'Aguard. Pix',
  WAITING_CONFIRMATION: 'Aguard. Confirmação',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em Preparo',
  READY: 'Pronto',
  DISPATCHED: 'Saiu p/ Entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  WAITING_PAYMENT_PROOF: 'bg-orange-100 text-orange-800',
  WAITING_CONFIRMATION: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-blue-200 text-blue-900',
  PREPARING: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  DISPATCHED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Entrega',
  PICKUP: 'Retirada',
  TABLE: 'Mesa',
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'Pix',
  CASH_ON_DELIVERY: 'Dinheiro',
}

const ALL_STATUSES = [
  'WAITING_PAYMENT_PROOF',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── OrderHistoryPage ─────────────────────────────────────────────────────────

export function OrderHistoryPage() {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [orders, setOrders] = useState<Order[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  async function loadOrders(cursor?: string) {
    setIsLoading(true)
    setIsError(false)
    try {
      const params: ListOrdersParams = {
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterPayment ? { paymentMethod: filterPayment } : {}),
        ...(filterDateFrom ? { dateFrom: new Date(filterDateFrom).toISOString() } : {}),
        ...(filterDateTo
          ? { dateTo: new Date(filterDateTo + 'T23:59:59').toISOString() }
          : {}),
        ...(cursor ? { cursor } : {}),
        limit: 50,
      }
      const result = await fetchOrders(params)
      if (cursor) {
        setOrders((prev) => [...prev, ...result.orders])
      } else {
        setOrders(result.orders)
      }
      setNextCursor(result.nextCursor)
      setHasLoaded(true)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setOrders([])
    setNextCursor(null)
    loadOrders()
  }

  function handleLoadMore() {
    if (nextCursor) {
      loadOrders(nextCursor)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/orders"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Ao Vivo
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Histórico de Pedidos</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pagamento</label>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="PIX">Pix</option>
                <option value="CASH_ON_DELIVERY">Dinheiro na entrega</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data início</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data fim</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>

            {(filterStatus || filterPayment || filterDateFrom || filterDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('')
                  setFilterPayment('')
                  setFilterDateFrom('')
                  setFilterDateTo('')
                }}
                className="rounded-md border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Limpar
              </button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isError && (
            <p className="text-center text-sm text-red-600 py-8">Erro ao carregar pedidos.</p>
          )}

          {!hasLoaded && !isLoading && !isError && (
            <p className="text-center text-sm text-gray-400 py-8">
              Use os filtros acima e clique em "Buscar" para carregar o histórico.
            </p>
          )}

          {isLoading && orders.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-8">Carregando...</p>
          )}

          {hasLoaded && orders.length === 0 && !isLoading && (
            <p className="text-center text-sm text-gray-500 py-8">Nenhum pedido encontrado.</p>
          )}

          {orders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Pagamento</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Total</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">#{order.number}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {order.clientName ?? order.client?.name ?? order.clientWhatsapp}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {TYPE_LABELS[order.type] ?? order.type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor && (
            <div className="px-4 py-4 border-t border-gray-100 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="rounded-md border border-gray-300 text-gray-700 px-6 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>
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
