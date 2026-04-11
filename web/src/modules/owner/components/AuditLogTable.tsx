import { useState } from 'react'

import { useAuditLogs } from '../hooks/useOwnerStores'

interface AuditLogTableProps {
  storeId: string
}

export function AuditLogTable({ storeId }: AuditLogTableProps) {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, isError } = useAuditLogs(storeId, {
    page,
    limit: 20,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
  })

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filtrar por ação (ex: store.create)"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Carregando logs...</p>}
      {isError && <p className="text-sm text-red-600">Erro ao carregar logs.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Ação</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Entidade</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{log.action}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {log.entity}
                      {log.entityId && (
                        <span className="ml-1 text-gray-400 font-mono text-xs">
                          ({log.entityId.slice(0, 8)}…)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {log.user
                        ? (log.user.name ?? log.user.email ?? log.user.id)
                        : <span className="italic text-gray-400">Sistema</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {data.logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {data.pagination.total} registros — página {data.pagination.page} de{' '}
              {data.pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page >= data.pagination.pages}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
