import { useState } from 'react'

import { useMotoboys } from '../hooks/useMotoboys'
import { useAssignMotoboy, useOrder, useUpdateOrderStatus } from '../hooks/useOrders'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
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
  CASH_ON_DELIVERY: 'Dinheiro na entrega',
}

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'WAITING_PAYMENT_PROOF',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DISPATCHED',
])

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderDetailModalProps {
  orderId: string
  isOpen: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderDetailModal({ orderId, isOpen, onClose }: OrderDetailModalProps) {
  const { data: order, isLoading, isError } = useOrder(orderId)
  const updateStatus = useUpdateOrderStatus()
  const assignMotoboy = useAssignMotoboy()
  const { data: motoboys } = useMotoboys()

  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showMotoboyPicker, setShowMotoboyPicker] = useState(false)
  const [selectedMotoboyId, setSelectedMotoboyId] = useState('')

  if (!isOpen) return null

  function handleAdvanceStatus(nextStatus: string) {
    if (!order) return
    updateStatus.mutate({ id: order.id, status: nextStatus })
  }

  function handleCancel(e: React.FormEvent) {
    e.preventDefault()
    if (!order || !cancelReason.trim()) return
    updateStatus.mutate(
      { id: order.id, status: 'CANCELLED', cancelReason: cancelReason.trim() },
      {
        onSuccess: () => {
          setShowCancelForm(false)
          setCancelReason('')
        },
      }
    )
  }

  function handleAssignMotoboy(e: React.FormEvent) {
    e.preventDefault()
    if (!order || !selectedMotoboyId) return
    assignMotoboy.mutate(
      { id: order.id, motoboyId: selectedMotoboyId },
      {
        onSuccess: () => {
          setShowMotoboyPicker(false)
          setSelectedMotoboyId('')
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl shadow-2xl max-h-screen sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {order ? `Pedido #${order.number}` : 'Detalhes do Pedido'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {isLoading && (
            <p className="text-center text-sm text-gray-500 py-8">Carregando pedido...</p>
          )}

          {isError && (
            <p className="text-center text-sm text-red-600 py-8">Erro ao carregar pedido.</p>
          )}

          {order && (
            <>
              {/* Info geral */}
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                  {TYPE_LABELS[order.type] ?? order.type}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                  {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                </span>
              </div>

              {/* Cliente */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Cliente</h3>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Nome:</span>{' '}
                  {order.clientName ?? order.client?.name ?? 'Não informado'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">WhatsApp:</span>{' '}
                  {order.clientWhatsapp ?? order.client?.whatsapp}
                </p>
              </div>

              {/* Endereço (DELIVERY) */}
              {order.type === 'DELIVERY' && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Endereço de entrega</h3>
                  {order.address ? (
                    <>
                      <p className="text-sm text-gray-700">
                        {order.address.street}, {order.address.number}
                        {order.address.complement ? ` — ${order.address.complement}` : ''}
                      </p>
                      <p className="text-sm text-gray-700">
                        {order.address.neighborhood} — {order.address.city}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Não informado</p>
                  )}
                </div>
              )}

              {/* Motoboy */}
              {order.motoboy && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Motoboy:</span>{' '}
                  {order.motoboy.name ?? 'Não identificado'}
                </div>
              )}

              {/* Cupom */}
              {order.coupon && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Cupom:</span> {order.coupon.code}
                </div>
              )}

              {/* Itens */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Itens ({order.items.length})
                </h3>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {item.quantity}x {item.productName}
                            {item.variationName ? (
                              <span className="text-gray-500 font-normal"> ({item.variationName})</span>
                            ) : null}
                          </p>
                          {item.additionals.length > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              + {item.additionals.map((a) => a.name).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-700 mt-0.5 italic">Obs: {item.notes}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 ml-2 whitespace-nowrap">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observações do pedido */}
              {order.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Observações do pedido</p>
                  <p className="text-sm text-amber-900">{order.notes}</p>
                </div>
              )}

              {/* Totais */}
              <div className="border-t border-gray-200 pt-4 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Taxa de entrega</span>
                    <span>{formatCurrency(order.deliveryFee)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Desconto</span>
                    <span>- {formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>

              {/* Histórico de timestamps */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Histórico</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  {[
                    { label: 'Criado', value: order.createdAt },
                    { label: 'Confirmado', value: order.confirmedAt },
                    { label: 'Em preparo', value: order.preparedAt },
                    { label: 'Despachado', value: order.dispatchedAt },
                    { label: 'Entregue', value: order.deliveredAt },
                    { label: 'Cancelado', value: order.cancelledAt },
                  ]
                    .filter((entry) => entry.value)
                    .map((entry) => (
                      <li key={entry.label} className="flex gap-2">
                        <span className="font-medium w-24 shrink-0">{entry.label}:</span>
                        <span>{formatDateTime(entry.value)}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Ações */}
              <div className="border-t border-gray-200 pt-4 space-y-3">
                {/* Aprovar Pix */}
                {order.status === 'WAITING_PAYMENT_PROOF' && (
                  <button
                    onClick={() => handleAdvanceStatus('CONFIRMED')}
                    disabled={updateStatus.isPending}
                    className="w-full rounded-lg bg-green-600 text-white py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {updateStatus.isPending ? 'Processando...' : 'Aprovar Pix'}
                  </button>
                )}

                {/* Confirmar Pedido */}
                {order.status === 'WAITING_CONFIRMATION' && (
                  <button
                    onClick={() => handleAdvanceStatus('CONFIRMED')}
                    disabled={updateStatus.isPending}
                    className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {updateStatus.isPending ? 'Processando...' : 'Confirmar Pedido'}
                  </button>
                )}

                {/* Atribuir Motoboy (READY + DELIVERY) */}
                {order.status === 'READY' && order.type === 'DELIVERY' && (
                  <div>
                    {!showMotoboyPicker ? (
                      <button
                        onClick={() => setShowMotoboyPicker(true)}
                        className="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Atribuir Motoboy e Despachar
                      </button>
                    ) : (
                      <form onSubmit={handleAssignMotoboy} className="space-y-2">
                        <select
                          value={selectedMotoboyId}
                          onChange={(e) => setSelectedMotoboyId(e.target.value)}
                          required
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Selecione o motoboy...</option>
                          {motoboys?.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={assignMotoboy.isPending || !selectedMotoboyId}
                            className="flex-1 rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {assignMotoboy.isPending ? 'Atribuindo...' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowMotoboyPicker(false)}
                            className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Marcar Retirado/Entregue (READY + PICKUP/TABLE) */}
                {order.status === 'READY' && (order.type === 'PICKUP' || order.type === 'TABLE') && (
                  <button
                    onClick={() => handleAdvanceStatus('DELIVERED')}
                    disabled={updateStatus.isPending}
                    className="w-full rounded-lg bg-green-600 text-white py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {updateStatus.isPending
                      ? 'Processando...'
                      : order.type === 'TABLE'
                        ? 'Marcar como Entregue'
                        : 'Marcar como Retirado'}
                  </button>
                )}

                {/* Cancelar pedido */}
                {ACTIVE_STATUSES.has(order.status) && (
                  <div>
                    {!showCancelForm ? (
                      <button
                        onClick={() => setShowCancelForm(true)}
                        className="w-full rounded-lg border border-red-300 text-red-600 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        Cancelar Pedido
                      </button>
                    ) : (
                      <form onSubmit={handleCancel} className="space-y-2">
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Informe o motivo do cancelamento..."
                          required
                          rows={3}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={updateStatus.isPending || !cancelReason.trim()}
                            className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {updateStatus.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCancelForm(false)
                              setCancelReason('')
                            }}
                            className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Voltar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
