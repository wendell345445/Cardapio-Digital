import { useAddPaymentAccess, useRemovePaymentAccess, useStoreClients } from '../hooks/usePaymentAccess'

export function ControleAcessoPage() {
  const { data: clients, isLoading, isError } = useStoreClients()
  const addMutation = useAddPaymentAccess()
  const removeMutation = useRemovePaymentAccess()

  function handleAdd(clientId: string, type: 'BLACKLIST' | 'WHITELIST') {
    addMutation.mutate(
      { clientId, type },
      { onError: () => alert('Erro ao atualizar acesso do cliente.') }
    )
  }

  function handleRemove(clientId: string) {
    removeMutation.mutate(clientId, {
      onError: () => alert('Erro ao remover acesso do cliente.'),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Controle de Acesso</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Blacklist / Whitelist de Clientes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Apenas clientes com histórico de pedido na loja aparecem aqui.
            </p>
          </div>

          {isLoading && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">Carregando clientes...</p>
          )}

          {isError && (
            <p className="px-6 py-8 text-sm text-red-600 text-center">
              Erro ao carregar clientes.
            </p>
          )}

          {clients && clients.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">
              Nenhum cliente com histórico encontrado.
            </p>
          )}

          {clients && clients.length > 0 && (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">WhatsApp</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600">Acesso</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                    <td className="px-6 py-4 text-gray-600">{client.whatsapp ?? '—'}</td>
                    <td className="px-6 py-4 text-center">
                      {client.accessType === 'BLACKLIST' ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                          Blacklist
                        </span>
                      ) : client.accessType === 'WHITELIST' ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                          Whitelist
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                          Nenhum
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAdd(client.id, 'BLACKLIST')}
                          disabled={addMutation.isPending || client.accessType === 'BLACKLIST'}
                          className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          Blacklist
                        </button>
                        <button
                          onClick={() => handleAdd(client.id, 'WHITELIST')}
                          disabled={addMutation.isPending || client.accessType === 'WHITELIST'}
                          className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          Whitelist
                        </button>
                        {client.accessId && (
                          <button
                            onClick={() => handleRemove(client.id)}
                            disabled={removeMutation.isPending}
                            className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
