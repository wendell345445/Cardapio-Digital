import { useState } from 'react'
import { Search, Plus, Pencil, X } from 'lucide-react'

import {
  useAddonCategories,
  useCreateAddon,
  useCreateAddonCategory,
  useDeleteAddon,
  useDeleteAddonCategory,
  useUpdateAddon,
} from '../hooks/useAdditionals'
import type { Addon, AddonCategory } from '../services/additionals.service'

import { ReauthModal } from '@/modules/auth/components/ReauthModal'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 flex-shrink-0 ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

interface EditAddonState {
  id: string
  name: string
  price: string
}

function CategoryContent({ category }: { category: AddonCategory }) {
  const updateAddon = useUpdateAddon()
  const createAddon = useCreateAddon()
  const deleteAddon = useDeleteAddon()

  const [editState, setEditState] = useState<EditAddonState | null>(null)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<Addon | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newPrice) return
    createAddon.mutate(
      { categoryId: category.id, name: newName.trim(), price: Number(newPrice) },
      {
        onSuccess: () => {
          setNewName('')
          setNewPrice('')
          setShowAdd(false)
        },
      }
    )
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    updateAddon.mutate(
      { id: editState.id, dto: { name: editState.name, price: Number(editState.price) } },
      { onSuccess: () => setEditState(null) }
    )
  }

  return (
    <div>
      <div className="divide-y divide-gray-50">
        {category.addons.map((addon) => (
          <div key={addon.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
            {editState?.id === addon.id ? (
              <form onSubmit={handleSaveEdit} className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value })}
                  autoFocus
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  type="number"
                  step="0.01"
                  value={editState.price}
                  onChange={(e) => setEditState((s) => s && { ...s, price: e.target.value })}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button type="submit" disabled={updateAddon.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditState(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                {addon.imageUrl ? (
                  <img src={addon.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">
                    📷
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{addon.name}</p>
                  <p className="text-sm text-gray-500">{fmt(addon.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Disponível</span>
                    <Toggle
                      checked={addon.isActive}
                      onChange={() => updateAddon.mutate({ id: addon.id, dto: { isActive: !addon.isActive } })}
                      disabled={updateAddon.isPending}
                    />
                  </div>
                  <button
                    onClick={() => setEditState({ id: addon.id, name: addon.name, price: String(addon.price) })}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => setToDelete(addon)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2 px-5 py-3 border-t border-gray-100">
          <input
            type="text"
            placeholder="Nome do adicional"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Preço"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            required
            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={createAddon.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
            Adicionar
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">
            Cancelar
          </button>
        </form>
      ) : null}

      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span>{category.addons.length} {category.addons.length === 1 ? 'item' : 'itens'}</span>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-red-500 hover:text-red-700 font-medium ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo adicional
        </button>
      </div>

      <ReauthModal
        open={!!toDelete}
        title="Excluir adicional"
        description={`Para excluir "${toDelete?.name ?? ''}", confirme sua senha.`}
        confirmLabel="Excluir"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return
          deleteAddon.mutate(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}

// ─── AdicionaisPage ────────────────────────────────────────────────────────────

export function AdicionaisPage() {
  const { data: categories, isLoading, isError } = useAddonCategories()
  const createCategory = useCreateAddonCategory()
  const deleteCategory = useDeleteAddonCategory()
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<AddonCategory | null>(null)

  const filtered = (categories ?? []).filter((c) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    if (c.name.toLowerCase().includes(term)) return true
    return c.addons.some((a) => a.name.toLowerCase().includes(term))
  })

  const selected = filtered.find((c) => c.id === activeCategoryId) ?? filtered[0] ?? null

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    createCategory.mutate(
      { name: newCategoryName.trim() },
      {
        onSuccess: (cat) => {
          setNewCategoryName('')
          setShowNewCategory(false)
          setActiveCategoryId(cat.id)
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button
          onClick={() => setShowNewCategory((v) => !v)}
          className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 hover:border-red-400 px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova categoria
        </button>
      </div>

      {showNewCategory && (
        <form onSubmit={handleCreateCategory} className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <input
            type="text"
            placeholder="Nome da categoria (ex: Acompanhamentos)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            autoFocus
            required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={createCategory.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
            Criar
          </button>
          <button type="button" onClick={() => setShowNewCategory(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">
            Cancelar
          </button>
        </form>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Adicionais</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cadastre itens adicionais organizados por categoria. Vincule aos produtos pelo modal de cada item.</p>
      </div>

      {isLoading && <p className="text-center text-sm text-gray-500 py-12">Carregando adicionais...</p>}
      {isError && <p className="text-center text-sm text-red-600 py-12">Erro ao carregar adicionais.</p>}

      {!isLoading && !isError && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>Nenhuma categoria de adicional cadastrada ainda.</p>
              <p className="text-xs mt-1">Crie uma categoria pra organizar os adicionais (ex: Acompanhamentos, Bebidas).</p>
            </div>
          ) : (
            <>
              <div className="flex overflow-x-auto border-b border-gray-200 px-4 pt-2 gap-1">
                {filtered.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                      selected?.id === cat.id
                        ? 'border-red-500 text-red-500'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {selected && (
                <>
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="font-semibold text-gray-900 text-sm">{selected.name}</span>
                    <button
                      onClick={() => setCategoryToDelete(selected)}
                      className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Excluir categoria
                    </button>
                  </div>

                  <CategoryContent category={selected} />
                </>
              )}
            </>
          )}
        </div>
      )}

      <ReauthModal
        open={!!categoryToDelete}
        title="Excluir categoria de adicionais"
        description={`Para excluir "${categoryToDelete?.name ?? ''}", confirme sua senha. A categoria precisa estar vazia.`}
        confirmLabel="Excluir"
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (!categoryToDelete) return
          deleteCategory.mutate(categoryToDelete.id, {
            onSuccess: () => {
              setCategoryToDelete(null)
              if (activeCategoryId === categoryToDelete.id) setActiveCategoryId(null)
            },
          })
        }}
      />
    </div>
  )
}
