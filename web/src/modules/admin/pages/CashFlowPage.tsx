import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  Clock,
  DollarSign,
  LockKeyhole,
  PlusCircle,
  UnlockKeyhole,
  X,
} from 'lucide-react'

import {
  useAddAdjustment,
  useCashFlowSummary,
  useCloseCashFlow,
  useCurrentCashFlow,
  useListCashFlows,
  useOpenCashFlow,
} from '../hooks/useCashFlow'
import type { AdjustmentType, CashFlow, CashFlowAdjustment } from '../services/cashflow.service'

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
}

// ─── Modals ───────────────────────────────────────────────────────────────────

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

// ── Open Cash Flow Modal ───────────────────────────────────────────────────────

function OpenCashFlowModal({ onClose }: { onClose: () => void }) {
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

// ── Adjustment Modal ───────────────────────────────────────────────────────────

function AdjustmentModal({
  cashFlowId,
  type,
  onClose,
}: {
  cashFlowId: string
  type: AdjustmentType
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const mutation = useAddAdjustment()

  const isSangria = type === 'BLEED'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) return
    mutation.mutate(
      { id: cashFlowId, type, amount: parsed, notes: notes || undefined },
      { onSuccess: onClose }
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isSangria ? 'Sangria de Caixa' : 'Suprimento de Caixa'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {isSangria
            ? 'Retirada de dinheiro do caixa para depósito ou outro fim.'
            : 'Adição de dinheiro ao caixa (troco, suprimento).'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da movimentação..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Erro ao registrar movimentação. Tente novamente.</p>
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
              className={`flex-1 rounded-lg text-white px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors ${
                isSangria
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {mutation.isPending ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  )
}

// ── Close Cash Flow Modal ──────────────────────────────────────────────────────

function CloseCashFlowModal({
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

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string
  value: string
  icon: React.ElementType
  colorClass: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Adjustment Row ───────────────────────────────────────────────────────────

function AdjustmentRow({ adj }: { adj: CashFlowAdjustment }) {
  const isSangria = adj.type === 'BLEED'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSangria ? 'bg-red-100' : 'bg-blue-100'
        }`}
      >
        {isSangria ? (
          <ArrowDownCircle className="w-4 h-4 text-red-600" />
        ) : (
          <ArrowUpCircle className="w-4 h-4 text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">
          {isSangria ? 'Sangria' : 'Suprimento'}
        </p>
        {adj.notes && <p className="text-xs text-gray-500 truncate">{adj.notes}</p>}
        <p className="text-xs text-gray-400">{formatDateTime(adj.createdAt)}</p>
      </div>
      <span className={`text-sm font-bold ${isSangria ? 'text-red-600' : 'text-blue-600'}`}>
        {isSangria ? '-' : '+'}{formatCurrency(adj.amount)}
      </span>
    </div>
  )
}

// ─── Open Cash Flow View ──────────────────────────────────────────────────────

function OpenCashFlowView({ cashFlow }: { cashFlow: CashFlow }) {
  const [showAdjModal, setShowAdjModal] = useState<AdjustmentType | null>(null)
  const [showCloseModal, setShowCloseModal] = useState(false)

  const { data: summaryResponse, isLoading: loadingSummary } = useCashFlowSummary(cashFlow.id)
  const summary = summaryResponse?.summary

  return (
    <div className="space-y-6">
      {/* Cash Flow Header Info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Caixa Aberto</p>
          <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            Aberto em {formatDateTime(cashFlow.openedAt)} · Troco inicial:{' '}
            {formatCurrency(cashFlow.initialAmount)}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            icon={DollarSign}
            label="Total Pedidos"
            value={formatCurrency(summary?.totalOrders ?? 0)}
            colorClass="bg-blue-100 text-blue-600"
          />
          <SummaryCard
            icon={DollarSign}
            label="Dinheiro"
            value={formatCurrency(summary?.totalCash ?? 0)}
            colorClass="bg-green-100 text-green-600"
          />
          <SummaryCard
            icon={DollarSign}
            label="Pix"
            value={formatCurrency(summary?.totalPix ?? 0)}
            colorClass="bg-purple-100 text-purple-600"
          />
          <SummaryCard
            icon={DollarSign}
            label="Saldo Esperado"
            value={formatCurrency(summary?.expectedCash ?? 0)}
            colorClass="bg-orange-100 text-orange-600"
          />
        </div>
      )}

      {/* Adjustments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Movimentações</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdjModal('SUPPLY')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Suprimento
            </button>
            <button
              onClick={() => setShowAdjModal('BLEED')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              Sangria
            </button>
          </div>
        </div>

        <div className="px-5 py-2">
          {cashFlow.adjustments.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Nenhuma movimentação</p>
          ) : (
            cashFlow.adjustments.map((adj) => (
              <AdjustmentRow key={adj.id} adj={adj} />
            ))
          )}
        </div>
      </div>

      {/* Close Cash Flow Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCloseModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
        >
          <LockKeyhole className="w-4 h-4" />
          Fechar Caixa
        </button>
      </div>

      {/* Modals */}
      {showAdjModal && (
        <AdjustmentModal
          cashFlowId={cashFlow.id}
          type={showAdjModal}
          onClose={() => setShowAdjModal(null)}
        />
      )}

      {showCloseModal && (
        <CloseCashFlowModal
          cashFlowId={cashFlow.id}
          expectedBalance={summary?.expectedCash ?? 0}
          onClose={() => setShowCloseModal(false)}
        />
      )}
    </div>
  )
}

// ─── History Table ────────────────────────────────────────────────────────────

function HistoryTable({ cashFlows }: { cashFlows: CashFlow[] }) {
  const closed = cashFlows.filter((c) => c.status === 'CLOSED')
  if (closed.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Histórico de Caixas</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Abertura
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Fechamento
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Troco Inicial
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Valor Contado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {closed.map((cf) => (
              <tr key={cf.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-700">{formatDateTime(cf.openedAt)}</td>
                <td className="px-4 py-3 text-gray-700">
                  {cf.closedAt ? formatDateTime(cf.closedAt) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatCurrency(cf.initialAmount)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {cf.countedAmount != null ? formatCurrency(cf.countedAmount) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CashFlowPage ─────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const [showOpenModal, setShowOpenModal] = useState(false)

  const { data: currentCashFlow, isLoading: loadingCurrent } = useCurrentCashFlow()
  const { data: allCashFlows, isLoading: loadingHistory } = useListCashFlows()

  const isOpen = currentCashFlow?.status === 'OPEN'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Caixa</h1>
          </div>

          {!loadingCurrent && !isOpen && (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm"
            >
              <UnlockKeyhole className="w-4 h-4" />
              Abrir Caixa
            </button>
          )}
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Loading */}
        {loadingCurrent && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* No open cashflow */}
        {!loadingCurrent && !isOpen && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <LockKeyhole className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Caixa Fechado</h2>
            <p className="text-sm text-gray-400 mb-6">
              Abra o caixa para começar a registrar movimentações e pedidos.
            </p>
            <button
              onClick={() => setShowOpenModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Abrir Caixa
            </button>
          </div>
        )}

        {/* Open cash flow view */}
        {!loadingCurrent && isOpen && currentCashFlow && (
          <OpenCashFlowView cashFlow={currentCashFlow} />
        )}

        {/* History */}
        {!loadingHistory && allCashFlows && allCashFlows.length > 0 && (
          <HistoryTable cashFlows={allCashFlows} />
        )}
      </main>

      {/* Open Modal */}
      {showOpenModal && <OpenCashFlowModal onClose={() => setShowOpenModal(false)} />}
    </div>
  )
}
