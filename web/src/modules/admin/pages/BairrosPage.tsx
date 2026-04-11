import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  useCreateNeighborhood,
  useDeleteNeighborhood,
  useDeliveryConfig,
  useUpdateNeighborhood,
} from '../hooks/useDelivery'
import type { Neighborhood } from '../services/delivery.service'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface EditState {
  id: string
  name: string
  fee: string
}

export function BairrosPage() {
  const { data: config, isLoading, isError } = useDeliveryConfig()
  const createNeighborhood = useCreateNeighborhood()
  const updateNeighborhood = useUpdateNeighborhood()
  const deleteNeighborhood = useDeleteNeighborhood()

  const [newName, setNewName] = useState('')
  const [newFee, setNewFee] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)

  const neighborhoods = config?.neighborhoods ?? []

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newFee) return
    createNeighborhood.mutate(
      { name: newName.trim(), fee: Number(newFee) },
      {
        onSuccess: () => {
          setNewName('')
          setNewFee('')
        },
      }
    )
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    updateNeighborhood.mutate(
      { id: editState.id, data: { name: editState.name, fee: Number(editState.fee) } },
      { onSuccess: () => setEditState(null) }
    )
  }

  function handleDelete(n: Neighborhood) {
    if (!window.confirm(`Excluir o bairro "${n.name}"?`)) return
    deleteNeighborhood.mutate(n.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bairros de Entrega</h1>
        <p className="text-sm text-gray-500 mt-0.5">Defina os bairros atendidos e suas taxas de entrega.</p>
      </div>

      {/* Inline create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Adicionar bairro</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Nome do bairro
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Centro, Jardim América..."
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Taxa (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              placeholder="0,00"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={createNeighborhood.isPending}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {createNeighborhood.isPending ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* List */}
      {isLoading && <p className="text-center text-sm text-gray-500 py-8">Carregando bairros...</p>}
      {isError && <p className="text-center text-sm text-red-600 py-8">Erro ao carregar bairros.</p>}

      {!isLoading && !isError && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Bairros cadastrados</span>
            <span className="text-xs text-gray-400">{neighborhoods.length} bairro(s)</span>
          </div>

          {neighborhoods.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>Nenhum bairro cadastrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {neighborhoods.map((n) => (
                <div key={n.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  {editState?.id === n.id ? (
                    <form onSubmit={handleSaveEdit} className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editState.name}
                        onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value })}
                        autoFocus
                        required
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editState.fee}
                        onChange={(e) => setEditState((s) => s && { ...s, fee: e.target.value })}
                        className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button type="submit" disabled={updateNeighborhood.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditState(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{n.name}</p>
                        <p className="text-xs text-gray-400">Taxa: {fmt(n.fee)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditState({ id: n.id, name: n.name, fee: String(n.fee) })}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(n)}
                          disabled={deleteNeighborhood.isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
