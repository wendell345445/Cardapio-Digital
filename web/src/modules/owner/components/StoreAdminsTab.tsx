import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPlus } from 'lucide-react'

import { PasswordInput } from '@/shared/components/PasswordInput'
import { api } from '@/shared/lib/api'

// ─── TASK-0910: Store Admins Tab ─────────────────────────────────────────────

interface StoreAdmin {
  id: string
  name: string | null
  email: string | null
  createdAt: string
}

async function fetchAdmins(storeId: string): Promise<StoreAdmin[]> {
  const { data } = await api.get(`/owner/stores/${storeId}/admins`)
  return data.data
}

async function createAdmin(
  storeId: string,
  payload: { name: string; email: string; password: string }
): Promise<StoreAdmin> {
  const { data } = await api.post(`/owner/stores/${storeId}/admins`, payload)
  return data.data
}

async function removeAdmin(storeId: string, userId: string): Promise<void> {
  await api.delete(`/owner/stores/${storeId}/admins/${userId}`)
}

interface StoreAdminsTabProps {
  storeId: string
}

const MAX_ADMINS = 5

export function StoreAdminsTab({ storeId }: StoreAdminsTabProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: admins, isLoading } = useQuery({
    queryKey: ['store-admins', storeId],
    queryFn: () => fetchAdmins(storeId),
  })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      createAdmin(storeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['store-admins', storeId] })
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      setFormError(null)
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao criar admin.'
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeAdmin(storeId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-admins', storeId] }),
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao remover admin.')
    },
  })

  function handleRemove(admin: StoreAdmin, isOriginal: boolean) {
    if (isOriginal) return
    if (!confirm(`Remover o admin ${admin.name ?? admin.email}?`)) return
    removeMutation.mutate(admin.id)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    createMutation.mutate(form)
  }

  if (isLoading) return <p className="text-sm text-gray-500 py-4">Carregando admins...</p>

  const count = admins?.length ?? 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Admins desta loja</h2>
            <p className="text-xs text-gray-500 mt-0.5">{count}/{MAX_ADMINS} admins</p>
          </div>
          {count < MAX_ADMINS && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar admin
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-5 space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Novo admin</h3>
            <input
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <PasswordInput
              placeholder="Senha temporária (min. 6 caracteres)"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {formError && (
              <p className="text-xs text-red-600">{formError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Criando...' : 'Criar admin'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null) }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-100">
          {(admins ?? []).map((admin, index) => {
            const isOriginal = index === 0
            return (
              <div key={admin.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {admin.name ?? '—'}
                    {isOriginal && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        Principal
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{admin.email}</p>
                </div>
                {!isOriginal && (
                  <button
                    onClick={() => handleRemove(admin, isOriginal)}
                    disabled={removeMutation.isPending}
                    className="text-red-400 hover:text-red-600 disabled:opacity-50 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
