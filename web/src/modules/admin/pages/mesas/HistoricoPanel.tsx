import { useMemo, useState } from 'react'

import { useClosedSessions } from '../../hooks/useTables'
import type { TablePaymentMethod } from '../../services/tables.service'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(openedAt: string, closedAt: string) {
  const min = Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60_000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const remMin = min % 60
  return `${h}h${remMin ? ` ${remMin}min` : ''}`
}

const METHOD_LABEL: Record<TablePaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
}

function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function HistoricoPanel() {
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState('')
  // Converte input date pra ISO range. `to` exclusivo do dia → adiciona 1 dia.
  const range = useMemo(() => {
    const result: { from?: string; to?: string } = {}
    if (from) result.from = new Date(`${from}T00:00:00`).toISOString()
    if (to) {
      const d = new Date(`${to}T00:00:00`)
      d.setDate(d.getDate() + 1)
      result.to = d.toISOString()
    }
    return result
  }, [from, to])

  const { data: sessions, isLoading, isError } = useClosedSessions(range)

  const total = (sessions ?? []).reduce((acc, s) => acc + s.subtotal, 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(todayISO())
            setTo('')
          }}
          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-2"
        >
          Hoje
        </button>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Receita do período</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="text-sm text-gray-500 text-center py-8">Carregando...</p>}
        {isError && <p className="text-sm text-red-600 text-center py-8">Erro ao carregar histórico.</p>}
        {!isLoading && !isError && (sessions ?? []).length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhuma sessão fechada no período.</p>
        )}
        {(sessions ?? []).length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Mesa</th>
                <th className="text-left px-4 py-2.5 font-medium">Aberta</th>
                <th className="text-left px-4 py-2.5 font-medium">Fechada</th>
                <th className="text-left px-4 py-2.5 font-medium">Duração</th>
                <th className="text-left px-4 py-2.5 font-medium">Pedidos</th>
                <th className="text-left px-4 py-2.5 font-medium">Pagto</th>
                <th className="text-left px-4 py-2.5 font-medium">Quem pediu</th>
                <th className="text-right px-4 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(sessions ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">Mesa {s.tableNumber}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDateTime(s.openedAt)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDateTime(s.closedAt)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDuration(s.openedAt, s.closedAt)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.ordersCount}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {s.paymentMethod ? METHOD_LABEL[s.paymentMethod] : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 truncate max-w-[180px]">
                    {s.deviceNames.length > 0 ? s.deviceNames.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {formatCurrency(s.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
