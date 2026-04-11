import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../hooks/useCategories'
import type { Category } from '../services/categories.service'
import { useProducts } from '../hooks/useProducts'

function useProductCountByCategory() {
  const { data: products } = useProducts({})
  const countMap: Record<string, number> = {}
  for (const p of products ?? []) {
    countMap[p.categoryId] = (countMap[p.categoryId] ?? 0) + 1
  }
  return countMap
}

interface EditState {
  id: string
  name: string
}

export function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const productCounts = useProductCountByCategory()

  const [newName, setNewName] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate(
      { name: newName.trim() },
      { onSuccess: () => setNewName('') }
    )
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    updateMutation.mutate(
      { id: editState.id, dto: { name: editState.name } },
      { onSuccess: () => setEditState(null) }
    )
  }

  function handleDelete(category: Category) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return
    deleteMutation.mutate(category.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize seus produtos em seções do cardápio</p>
        </div>
        <span className="text-sm text-gray-500">
          Total de categorias: <span className="font-semibold">{categories?.length ?? 0}</span>
        </span>
      </div>

      {/* Inline create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900">Nova categoria</h2>
        <p className="text-sm text-gray-500 mb-4">Crie uma nova seção para seu cardápio</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da categoria"
              minLength={2}
              maxLength={100}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              type="text"
              placeholder="Descrição (opcional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar categoria'}
          </button>
        </form>
        {createMutation.isError && (
          <p className="mt-2 text-sm text-red-600">Erro ao criar categoria. Tente novamente.</p>
        )}
      </div>

      {/* List */}
      {isLoading && (
        <p className="text-center text-sm text-gray-500 py-8">Carregando categorias...</p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-600 py-8">Erro ao carregar categorias.</p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {(categories ?? []).length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-400">Nenhuma categoria cadastrada.</p>
            </div>
          )}

          {(categories ?? []).map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4"
            >
              {editState?.id === category.id ? (
                <form onSubmit={handleSaveEdit} className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value })}
                    autoFocus
                    required
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditState(null)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{category.name}</p>
                    <p className="text-xs text-gray-400">Sem descrição</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full">
                        Nova
                      </span>
                      <span className="text-xs text-gray-500">
                        {productCounts[category.id] ?? 0} produto(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditState({ id: category.id, name: category.name })}
                      className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
