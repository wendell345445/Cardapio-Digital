import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import {
  useCreateMotoboy,
  useDeleteMotoboy,
  useMotoboys,
  useUpdateMotoboy,
} from '../hooks/useMotoboys'
import type { Motoboy } from '../services/motoboys.service'

type MotoboyToast = { message: string; type: 'success' | 'error' } | null

function MotoboyToastView({ toast, onClose }: { toast: MotoboyToast; onClose: () => void }) {
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

function EditMotoboyModal({
  motoboy,
  onClose,
  onToast,
}: {
  motoboy: Motoboy
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const updateMutation = useUpdateMotoboy()
  const [name, setName] = useState(motoboy.name)
  const [whatsapp, setWhatsapp] = useState(motoboy.whatsapp ?? '')
  const [email, setEmail] = useState(motoboy.email ?? '')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const dto = {
      name: name.trim(),
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,
      email: email.trim() ? email.trim() : null,
      ...(password ? { password } : {}),
    }
    updateMutation.mutate(
      { id: motoboy.id, dto },
      {
        onSuccess: () => {
          onToast('Motoboy atualizado!', 'success')
          onClose()
        },
        onError: (err) => onToast(extractApiError(err, 'Erro ao atualizar motoboy.'), 'error'),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Editar Motoboy</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5511999999999"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova senha <span className="text-xs text-gray-400">(deixe em branco para manter)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function MotoboysPage() {
  const { data: motoboys, isLoading, isError } = useMotoboys()
  const createMutation = useCreateMotoboy()
  const deleteMutation = useDeleteMotoboy()

  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<MotoboyToast>(null)
  const [editing, setEditing] = useState<Motoboy | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return
    createMutation.mutate(
      {
        name: name.trim(),
        ...(whatsapp.trim() && { whatsapp: whatsapp.trim() }),
        ...(email.trim() && { email: email.trim() }),
        password,
      },
      {
        onSuccess: () => {
          setName('')
          setWhatsapp('')
          setEmail('')
          setPassword('')
          showToast('Motoboy adicionado!', 'success')
        },
        onError: (err) => showToast(extractApiError(err, 'Erro ao adicionar motoboy.'), 'error'),
      }
    )
  }

  function handleDelete(id: string, motoboyName: string) {
    if (!window.confirm(`Remover o motoboy "${motoboyName}"?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => showToast('Motoboy removido.', 'success'),
      onError: (err) => showToast(extractApiError(err, 'Erro ao remover motoboy.'), 'error'),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Motoboys</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <MotoboyToastView toast={toast} onClose={() => setToast(null)} />

        {/* Formulário inline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Adicionar Motoboy</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="5511999999999"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Adicionando...' : 'Adicionar Motoboy'}
            </button>
          </form>
        </div>

        {/* Listagem */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Motoboys Cadastrados</h2>
          </div>

          {isLoading && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">Carregando...</p>
          )}

          {isError && (
            <p className="px-6 py-8 text-sm text-red-600 text-center">
              Erro ao carregar motoboys.
            </p>
          )}

          {motoboys && motoboys.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">
              Nenhum motoboy cadastrado.
            </p>
          )}

          {motoboys && motoboys.length > 0 && (
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">WhatsApp</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">E-mail</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {motoboys.map((motoboy) => (
                  <tr key={motoboy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{motoboy.name}</td>
                    <td className="px-6 py-4 text-gray-600">{motoboy.whatsapp ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{motoboy.email ?? '—'}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => setEditing(motoboy)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(motoboy.id, motoboy.name)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:underline text-xs font-medium disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editing && (
          <EditMotoboyModal
            motoboy={editing}
            onClose={() => setEditing(null)}
            onToast={showToast}
          />
        )}
      </main>
    </div>
  )
}
