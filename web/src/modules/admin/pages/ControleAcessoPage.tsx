import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import {
  useAddPaymentAccess,
  useAddPaymentAccessByWhatsapp,
  useRemovePaymentAccess,
  useStoreClients,
} from '../hooks/usePaymentAccess'

type Toast = { message: string; type: 'success' | 'error' } | null

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  if (!toast) return null
  return (
    <div
      role="alert"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100" aria-label="Fechar">
        <X size={14} />
      </button>
    </div>
  )
}

function extractApiError(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { error?: string; message?: string } } }
  return maybe?.response?.data?.error ?? maybe?.response?.data?.message ?? fallback
}

export function ControleAcessoPage() {
  const { data: clients, isLoading, isError } = useStoreClients()
  const addMutation = useAddPaymentAccess()
  const addByWhatsappMutation = useAddPaymentAccessByWhatsapp()
  const removeMutation = useRemovePaymentAccess()

  const [toast, setToast] = useState<Toast>(null)
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [type, setType] = useState<'BLACKLIST' | 'WHITELIST'>('BLACKLIST')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  function handleAdd(clientId: string, accessType: 'BLACKLIST' | 'WHITELIST') {
    addMutation.mutate(
      { clientId, type: accessType },
      {
        onSuccess: () => showToast('Acesso atualizado.', 'success'),
        onError: (err) => showToast(extractApiError(err, 'Erro ao atualizar acesso do cliente.'), 'error'),
      }
    )
  }

  function handleRemove(clientId: string) {
    removeMutation.mutate(clientId, {
      onSuccess: () => showToast('Acesso removido.', 'success'),
      onError: (err) => showToast(extractApiError(err, 'Erro ao remover acesso do cliente.'), 'error'),
    })
  }

  function handleAddByWhatsapp(e: React.FormEvent) {
    e.preventDefault()
    const digits = whatsapp.replace(/\D/g, '')
    if (digits.length < 10) {
      showToast('Informe um WhatsApp válido (mínimo 10 dígitos).', 'error')
      return
    }
    addByWhatsappMutation.mutate(
      {
        whatsapp: digits,
        ...(name.trim() ? { name: name.trim() } : {}),
        type,
      },
      {
        onSuccess: (result) => {
          setName('')
          setWhatsapp('')
          setType('BLACKLIST')
          showToast(
            result.createdNewUser
              ? 'Cliente adicionado e classificado.'
              : 'Cliente existente classificado.',
            'success'
          )
        },
        onError: (err) => showToast(extractApiError(err, 'Erro ao adicionar cliente.'), 'error'),
      }
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Controle de Acesso</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <ToastView toast={toast} onClose={() => setToast(null)} />

        {/* Form: adicionar manualmente por WhatsApp (ADR-0002) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Adicionar Cliente</h2>
          <p className="text-sm text-gray-500 mb-4">
            Classifique um cliente pelo WhatsApp, mesmo que ele ainda não tenha feito pedidos na loja.
          </p>
          <form onSubmit={handleAddByWhatsapp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="5511999999999"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">
                Tipo <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="accessType"
                    checked={type === 'BLACKLIST'}
                    onChange={() => setType('BLACKLIST')}
                    className="h-4 w-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Blacklist</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="accessType"
                    checked={type === 'WHITELIST'}
                    onChange={() => setType('WHITELIST')}
                    className="h-4 w-4 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Whitelist</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={addByWhatsappMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addByWhatsappMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          </form>
        </div>

        {/* Listagem: clientes da loja (com histórico + adicionados manualmente) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Blacklist / Whitelist de Clientes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Inclui clientes com histórico de pedido e os adicionados manualmente acima.
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
              Nenhum cliente encontrado. Adicione manualmente pelo form acima.
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
