import { useState } from 'react'

import { useCreateTable, useTables } from '../hooks/useTables'
import { downloadQRCodePDF } from '../services/tables.service'
import type { TableWithComanda } from '../services/tables.service'
import { ComandaModal } from './ComandaModal'

function TableCard({
  table,
  onOpenComanda,
  onDownloadQR,
  isDownloading,
}: {
  table: TableWithComanda
  onOpenComanda: (t: TableWithComanda) => void
  onDownloadQR: (t: TableWithComanda) => void
  isDownloading: boolean
}) {
  const hasOpenOrder = table.orders.length > 0
  const isOccupied = table.isOccupied || hasOpenOrder

  const statusColor = isOccupied
    ? 'border-red-300 bg-red-50'
    : 'border-green-300 bg-green-50'

  const badgeColor = isOccupied
    ? 'bg-red-100 text-red-800'
    : 'bg-green-100 text-green-800'

  const statusLabel = isOccupied ? 'Ocupada' : 'Livre'

  return (
    <div
      className={`rounded-xl border-2 ${statusColor} p-4 flex flex-col gap-3 transition-all`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">Mesa {table.number}</span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {hasOpenOrder && (
        <p className="text-xs text-gray-600">
          {table.orders[0]?.items?.length ?? 0} iten(s) na comanda
        </p>
      )}

      <div className="flex flex-col gap-2 mt-auto">
        {isOccupied && (
          <button
            onClick={() => onOpenComanda(table)}
            className="w-full rounded-lg bg-orange-500 text-white py-1.5 text-xs font-medium hover:bg-orange-600 transition-colors"
          >
            Ver Comanda
          </button>
        )}
        <button
          onClick={() => onDownloadQR(table)}
          disabled={isDownloading}
          className="w-full rounded-lg border border-gray-300 text-gray-700 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {isDownloading ? 'Gerando PDF...' : 'Gerar QR Code (PDF)'}
        </button>
      </div>
    </div>
  )
}

export function TablesPage() {
  const { data: tables, isLoading, isError } = useTables()
  const createMutation = useCreateTable()

  const [newNumber, setNewNumber] = useState('')
  const [selectedTable, setSelectedTable] = useState<TableWithComanda | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const number = parseInt(newNumber, 10)
    if (!number || number < 1) return
    createMutation.mutate(
      { number },
      {
        onSuccess: () => setNewNumber(''),
      }
    )
  }

  async function handleDownloadQR(table: TableWithComanda) {
    if (downloadingId) return
    setDownloadingId(table.id)
    try {
      await downloadQRCodePDF(table.id, table.number)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Mesas</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Create form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nova mesa</h2>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número da mesa
              </label>
              <input
                type="number"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                min={1}
                required
                placeholder="Ex: 1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Mesa'}
            </button>
          </form>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-red-600">Erro ao criar mesa. Tente novamente.</p>
          )}
        </div>

        {/* Tables grid */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Mesas cadastradas</h2>

          {isLoading && (
            <p className="text-center text-sm text-gray-500 py-8">Carregando mesas...</p>
          )}

          {isError && (
            <p className="text-center text-sm text-red-600 py-8">Erro ao carregar mesas.</p>
          )}

          {tables && tables.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-8">Nenhuma mesa cadastrada.</p>
          )}

          {tables && tables.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onOpenComanda={setSelectedTable}
                  onDownloadQR={handleDownloadQR}
                  isDownloading={downloadingId === table.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedTable && (
        <ComandaModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onTableClosed={() => setSelectedTable(null)}
        />
      )}
    </div>
  )
}
