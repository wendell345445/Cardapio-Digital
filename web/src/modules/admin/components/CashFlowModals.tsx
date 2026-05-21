import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { useCloseCashFlow, useOpenCashFlow } from '../hooks/useCashFlow'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function OpenCashFlowModal({ onClose }: { onClose: () => void }) {
  const [initialAmount, setInitialAmount] = useState('')
  const mutation = useOpenCashFlow()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(initialAmount.replace(',', '.'))
    if (isNaN(amount) || amount < 0) return
    mutation.mutate(amount, { onSuccess: onClose })
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Abrir Caixa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Troco Inicial (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Erro ao abrir caixa. Tente novamente.</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Abrindo...' : 'Abrir Caixa'}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  )
}

export function CloseCashFlowModal({
  cashFlowId,
  expectedBalance,
  onClose,
}: {
  cashFlowId: string
  expectedBalance: number
  onClose: () => void
}) {
  const [countedAmount, setCountedAmount] = useState('')
  const [justification, setJustification] = useState('')
  const mutation = useCloseCashFlow()

  const parsed = parseFloat(countedAmount.replace(',', '.'))
  const difference = !isNaN(parsed) ? parsed - expectedBalance : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(parsed) || parsed < 0) return
    mutation.mutate(
      { id: cashFlowId, countedAmount: parsed, justification: justification || undefined },
      { onSuccess: onClose }
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Fechar Caixa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Saldo esperado:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(expectedBalance)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Contado (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              required
            />
            {difference !== null && (
              <p
                className={`text-xs mt-1 font-medium ${
                  difference === 0
                    ? 'text-green-600'
                    : difference > 0
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              >
                Diferença: {difference >= 0 ? '+' : ''}
                {formatCurrency(difference)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Justificativa <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={2}
              placeholder="Explique eventuais diferenças..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Erro ao fechar caixa. Tente novamente.</p>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Esta ação não pode ser desfeita. Confirme os valores antes de prosseguir.</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Fechando...' : 'Fechar Caixa'}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  )
}
