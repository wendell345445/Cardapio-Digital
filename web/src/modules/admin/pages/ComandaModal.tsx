import { useState } from 'react'

import { useComanda, useUpdateItemStatus, useCloseTable } from '../hooks/useTables'
import type { TableWithComanda } from '../services/tables.service'

interface Props {
  table: TableWithComanda
  onClose: () => void
  onTableClosed: () => void
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PREPARING: 'Em Preparo',
  DELIVERED: 'Entregue',
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ComandaModal({ table, onClose, onTableClosed }: Props) {
  const { data: comanda, isLoading, isError } = useComanda(table.id)
  const updateStatus = useUpdateItemStatus()
  const closeTableMutation = useCloseTable()

  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [applyServiceCharge, setApplyServiceCharge] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState(10)

  const serviceChargeAmount =
    applyServiceCharge && comanda?.subtotal
      ? (comanda.subtotal * serviceChargePercent) / 100
      : 0

  const finalTotal = (comanda?.subtotal ?? 0) + serviceChargeAmount

  function handleMarkDelivered(itemId: string) {
    updateStatus.mutate({ tableId: table.id, itemId, status: 'DELIVERED' })
  }

  function handleCloseTable() {
    closeTableMutation.mutate(
      {
        id: table.id,
        dto: {
          applyServiceCharge,
          serviceChargePercent: applyServiceCharge ? serviceChargePercent : undefined,
        },
      },
      {
        onSuccess: () => {
          setShowCloseConfirm(false)
          onTableClosed()
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Mesa N°{table.number} — Comanda</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <p className="text-center text-sm text-gray-500 py-8">Carregando comanda...</p>
          )}
          {isError && (
            <p className="text-center text-sm text-red-600 py-8">Erro ao carregar comanda.</p>
          )}

          {comanda && !comanda.order && (
            <p className="text-center text-sm text-gray-500 py-8">
              Nenhuma comanda aberta para esta mesa.
            </p>
          )}

          {comanda?.order && (
            <div className="space-y-3">
              {comanda.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {item.quantity}x {item.productName}
                      {item.variationName && (
                        <span className="text-gray-500 font-normal"> — {item.variationName}</span>
                      )}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">Obs: {item.notes}</p>
                    )}
                    {item.additionals.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        + {item.additionals.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">{formatCurrency(item.totalPrice)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[item.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.status !== 'DELIVERED' && (
                      <button
                        onClick={() => handleMarkDelivered(item.id)}
                        disabled={updateStatus.isPending}
                        className="text-xs text-green-600 hover:underline disabled:opacity-50"
                      >
                        Marcar Entregue
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {comanda?.order && (
          <div className="border-t border-gray-200 px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(comanda.subtotal)}</span>
            </div>

            {!showCloseConfirm ? (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="w-full rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Fechar Comanda
              </button>
            ) : (
              <div className="space-y-3 rounded-lg bg-gray-50 p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-800">Confirmar fechamento</p>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={applyServiceCharge}
                    onChange={(e) => setApplyServiceCharge(e.target.checked)}
                    className="rounded"
                  />
                  Adicionar taxa de serviço
                </label>

                {applyServiceCharge && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={serviceChargePercent}
                      onChange={(e) => setServiceChargePercent(Number(e.target.value))}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">%</span>
                    <span className="text-sm text-gray-600">
                      = {formatCurrency(serviceChargeAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCloseTable}
                    disabled={closeTableMutation.isPending}
                    className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {closeTableMutation.isPending ? 'Fechando...' : 'Confirmar'}
                  </button>
                </div>

                {closeTableMutation.isError && (
                  <p className="text-xs text-red-600">Erro ao fechar comanda. Tente novamente.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
