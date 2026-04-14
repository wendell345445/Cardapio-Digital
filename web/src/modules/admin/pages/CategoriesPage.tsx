import { useEffect, useState } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'


import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../hooks/useCategories'
import type { Category } from '../services/categories.service'
import { useProducts } from '../hooks/useProducts'
import type { Product } from '../services/products.service'

import { ReauthModal } from '@/modules/auth/components/ReauthModal'

function useProductsByCategory() {
  const { data: products } = useProducts({})
  const byCategory: Record<string, Product[]> = {}
  for (const p of products ?? []) {
    if (!byCategory[p.categoryId]) byCategory[p.categoryId] = []
    byCategory[p.categoryId].push(p)
  }
  return byCategory
}

interface EditState {
  id: string
  name: string
  description: string
}

export function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const productsByCategory = useProductsByCategory()

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Estado local para suportar reorder otimista durante drag-and-drop.
  // Sincroniza com o resultado de useCategories quando o query retorna.
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  useEffect(() => {
    if (categories) setOrderedCategories(categories)
  }, [categories])

  async function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const fromIndex = orderedCategories.findIndex((c) => c.id === draggedId)
    const toIndex = orderedCategories.findIndex((c) => c.id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const next = [...orderedCategories]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setOrderedCategories(next)
    setDraggedId(null)
    setDragOverId(null)

    try {
      await Promise.all(
        next.map((c, index) =>
          c.order === index
            ? Promise.resolve()
            : updateMutation.mutateAsync({ id: c.id, dto: { order: index } })
        )
      )
      showSuccess('Ordem das categorias atualizada')
    } catch {
      setReorderError('Erro ao salvar nova ordem. Tente novamente.')
      if (categories) setOrderedCategories(categories)
    }
  }

  function showSuccess(msg: string) {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage((current) => (current === msg ? null : current)), 3000)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const name = newName.trim()
    const description = newDescription.trim() || null
    createMutation.mutate(
      { name, description },
      {
        onSuccess: () => {
          setNewName('')
          setNewDescription('')
          showSuccess(`Categoria "${name}" criada com sucesso!`)
        },
      }
    )
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    const name = editState.name
    const description = editState.description.trim() || null
    updateMutation.mutate(
      { id: editState.id, dto: { name, description } },
      {
        onSuccess: () => {
          setEditState(null)
          showSuccess(`Categoria "${name}" atualizada com sucesso!`)
        },
      }
    )
  }

  function handleDelete(category: Category) {
    setDeleteError(null)
    setCategoryToDelete(category)
  }

  function confirmDelete() {
    if (!categoryToDelete) return
    const name = categoryToDelete.name
    deleteMutation.mutate(categoryToDelete.id, {
      onSuccess: () => {
        setCategoryToDelete(null)
        showSuccess(`Categoria "${name}" excluída com sucesso!`)
      },
      onError: (err: unknown) => {
        const data = (err as { response?: { data?: { error?: string; message?: string } } })
          ?.response?.data
        const message =
          data?.error ?? data?.message ?? 'Erro ao excluir categoria. Tente novamente.'
        setDeleteError(message)
        setCategoryToDelete(null)
      },
    })
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
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              maxLength={500}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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

      {/* Success banner */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-green-700">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800 text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-red-700">{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Reorder error banner */}
      {reorderError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-red-700">{reorderError}</p>
          <button
            onClick={() => setReorderError(null)}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Hint de drag-and-drop */}
      {!isLoading && !isError && orderedCategories.length > 1 && (
        <p className="text-xs text-gray-500">
          Arraste pelo ícone <GripVertical className="inline w-3 h-3 -mt-0.5" /> para reordenar as categorias. A ordem é refletida nas tabs do cardápio público.
        </p>
      )}

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

          {orderedCategories.map((category) => {
            const isEditing = editState?.id === category.id
            const categoryProducts = productsByCategory[category.id] ?? []
            const isDragged = draggedId === category.id
            const isDragOver = dragOverId === category.id && draggedId !== category.id
            return (
            <div
              key={category.id}
              draggable={!isEditing}
              onDragStart={(e) => {
                if (isEditing) return
                setDraggedId(category.id)
                // Alguns browsers exigem dataTransfer setado pra iniciar o drag.
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', category.id)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDragOverId(null)
              }}
              onDragOver={(e) => {
                if (!draggedId || isEditing) return
                e.preventDefault()
                if (dragOverId !== category.id) setDragOverId(category.id)
              }}
              onDragLeave={() => {
                if (dragOverId === category.id) setDragOverId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(category.id)
              }}
              className={`bg-white rounded-xl border px-5 py-4 flex items-center gap-4 transition-all ${
                !isEditing ? 'cursor-grab active:cursor-grabbing' : ''
              } ${isDragged ? 'opacity-40' : ''} ${
                isDragOver ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200'
              }`}
            >
              {!isEditing && (
                <span
                  aria-hidden="true"
                  className="text-gray-400 -ml-1 select-none"
                >
                  <GripVertical className="w-4 h-4" />
                </span>
              )}
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editState!.name}
                    onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value })}
                    autoFocus
                    required
                    placeholder="Nome"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <input
                    type="text"
                    value={editState!.description}
                    onChange={(e) => setEditState((s) => s && { ...s, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    maxLength={500}
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
                    <p className="text-xs text-gray-400">
                      {category.description?.trim() ? category.description : 'Sem descrição'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full">
                        Nova
                      </span>
                      <span className="text-xs text-gray-500">
                        {categoryProducts.length} produto(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setEditState({
                          id: category.id,
                          name: category.name,
                          description: category.description ?? '',
                        })
                      }
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
          )
          })}
        </div>
      )}

      <ReauthModal
        open={!!categoryToDelete}
        title="Excluir categoria"
        description={`Para excluir a categoria "${categoryToDelete?.name ?? ''}", confirme sua senha.`}
        confirmLabel="Excluir"
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
