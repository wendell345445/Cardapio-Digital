import { useState } from 'react'
import { ChevronRight, Download, Medal, Search, Users } from 'lucide-react'

import { ClientDetailModal } from '../components/ClientDetailModal'
import { useClientRanking } from '../hooks/useAnalytics'
import type { ClientRankingItem } from '../services/analytics.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ─── Podium styling (top-3) ───────────────────────────────────────────────────

function podiumStyle(position: number) {
  if (position === 1)
    return {
      ring: 'ring-2 ring-yellow-400',
      badge: 'bg-yellow-400 text-white',
      medal: 'text-yellow-500',
    }
  if (position === 2)
    return {
      ring: 'ring-2 ring-gray-300',
      badge: 'bg-gray-300 text-gray-800',
      medal: 'text-gray-400',
    }
  return {
    ring: 'ring-2 ring-amber-600',
    badge: 'bg-amber-700 text-white',
    medal: 'text-amber-600',
  }
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(clients: ClientRankingItem[]) {
  const headers = ['Posição', 'Nome', 'WhatsApp', 'Pedidos', 'Total Gasto', 'Último Pedido']
  const rows = clients.map((c) => [
    c.position,
    c.name ?? '',
    c.whatsapp,
    c.totalOrders,
    c.totalSpent.toFixed(2).replace('.', ','),
    formatDate(c.lastOrderAt),
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ranking-clientes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
}

// ─── Period Buttons ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Todos' },
] as const

type PeriodOption = (typeof PERIOD_OPTIONS)[number]['value']

// ─── ClientsPage ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export function ClientsPage() {
  const [periodOpt, setPeriodOpt] = useState<PeriodOption>('7d')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedWhatsapp, setSelectedWhatsapp] = useState<string | null>(null)

  const { data, isLoading, isFetching, isError } = useClientRanking({
    period: periodOpt,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  })

  const showSkeleton = isLoading || isFetching

  const clients = data?.clients ?? []
  const totalPages = data?.totalPages ?? 1

  // Pódio: top 3 só aparece na página 1 e quando não há busca ativa.
  const showPodium = !search && page === 1
  const topThree = showPodium ? clients.slice(0, 3) : []
  const tableClients = showPodium ? clients.slice(3) : clients

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handlePeriodChange(opt: PeriodOption) {
    setPeriodOpt(opt)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period Selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodChange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  periodOpt === opt.value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nome ou WhatsApp..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Buscar
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSearchInput('')
                  setPage(1)
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
              >
                Limpar
              </button>
            )}
          </form>
        </div>
      </header>

      <main className="p-6">
        {/* Export + count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Carregando...' : `${data?.total ?? 0} clientes encontrados`}
          </p>
          <button
            onClick={() => clients.length > 0 && exportCSV(clients)}
            disabled={isLoading || clients.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Error */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4">
            Erro ao carregar clientes. Tente novamente.
          </div>
        )}

        {/* Pódio Top 3 */}
        {showPodium && !showSkeleton && topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {topThree.map((client) => {
              const s = podiumStyle(client.position)
              return (
                <button
                  key={client.clientId}
                  onClick={() => setSelectedWhatsapp(client.whatsapp)}
                  className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md transition-all ${s.ring}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow ${s.badge}`}
                    >
                      {client.position}
                    </span>
                    <Medal className={`w-6 h-6 ${s.medal}`} />
                  </div>
                  <p className="font-semibold text-gray-900 truncate">
                    {client.name ?? 'Sem nome'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{client.whatsapp}</p>
                  <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Pedidos
                      </p>
                      <p className="text-sm font-semibold text-gray-700">
                        {client.totalOrders}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Total gasto
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(client.totalSpent)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Pódio skeleton */}
        {showPodium && showSkeleton && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <Skeleton className="h-8 w-8 rounded-full mb-3" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Tabela — posições 4+ (ou todas se busca/página >1) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">
                    Posição
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Pedidos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Total Gasto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Último Pedido
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {showSkeleton &&
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5">
                        <Skeleton className="h-6 w-6 rounded-full" />
                      </td>
                      <td className="px-4 py-2.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-28 mt-1" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Skeleton className="h-3.5 w-8 ml-auto" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Skeleton className="h-3.5 w-20 ml-auto" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Skeleton className="h-3.5 w-20 ml-auto" />
                      </td>
                      <td />
                    </tr>
                  ))}

                {!showSkeleton && tableClients.length === 0 && !showPodium && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                )}

                {!showSkeleton &&
                  tableClients.map((client) => (
                    <tr
                      key={client.clientId}
                      onClick={() => setSelectedWhatsapp(client.whatsapp)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 font-semibold text-sm">
                          {client.position}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">
                          {client.name ?? 'Sem nome'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{client.whatsapp}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                        {client.totalOrders}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        {formatCurrency(client.totalSpent)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {formatDate(client.lastOrderAt)}
                      </td>
                      <td className="px-2 text-gray-300">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedWhatsapp && (
        <ClientDetailModal
          whatsapp={selectedWhatsapp}
          onClose={() => setSelectedWhatsapp(null)}
        />
      )}
    </div>
  )
}
