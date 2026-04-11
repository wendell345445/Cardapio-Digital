import { useState } from 'react'
import { Search, Plus, Copy, ArrowUpDown, Pencil, X } from 'lucide-react'

import {
  useAdditionals,
  useCreateAdditionalItem,
  useDeleteAdditionalItem,
  useUpdateAdditionalItem,
} from '../hooks/useAdditionals'
import type { AdditionalItem } from '../services/additionals.service'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ItemToggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
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

interface EditItemState {
  id: string
  name: string
  price: string
}

function GroupContent({
  groupId,
  items,
}: {
  groupId: string
  items: AdditionalItem[]
}) {
  const updateItem = useUpdateAdditionalItem()
  const createItem = useCreateAdditionalItem()
  const deleteItem = useDeleteAdditionalItem()

  const [editState, setEditState] = useState<EditItemState | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim() || !newItemPrice) return
    createItem.mutate(
      { productId: groupId, dto: { name: newItemName.trim(), price: Number(newItemPrice) } },
      {
        onSuccess: () => {
          setNewItemName('')
          setNewItemPrice('')
          setShowAdd(false)
        },
      }
    )
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    updateItem.mutate(
      { id: editState.id, dto: { name: editState.name, price: Number(editState.price) } },
      { onSuccess: () => setEditState(null) }
    )
  }

  return (
    <div>
      <div className="divide-y divide-gray-50">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
            {editState?.id === item.id ? (
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
                <button type="submit" disabled={updateItem.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditState(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                {/* Placeholder thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">
                  📷
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{fmt(item.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Disponível</span>
                    <ItemToggle
                      checked={item.isActive}
                      onChange={() => updateItem.mutate({ id: item.id, dto: { isActive: !item.isActive } })}
                      disabled={updateItem.isPending}
                    />
                  </div>
                  <button
                    onClick={() => setEditState({ id: item.id, name: item.name, price: String(item.price) })}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir "${item.name}"?`)) {
                        deleteItem.mutate(item.id)
                      }
                    }}
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

      {/* Add item */}
      {showAdd ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2 px-5 py-3 border-t border-gray-100">
          <input
            type="text"
            placeholder="Nome do item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
            required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Preço"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            required
            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={createItem.isPending} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">
            Adicionar
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">
            Cancelar
          </button>
        </form>
      ) : null}

      {/* Footer actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span>{items.length} itens</span>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-red-500 hover:text-red-700 font-medium ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo item
        </button>
        <button className="flex items-center gap-1 hover:text-gray-700">
          <Copy className="w-3.5 h-3.5" />
          Copiar item
        </button>
        <button className="flex items-center gap-1 hover:text-gray-700">
          <ArrowUpDown className="w-3.5 h-3.5" />
          Ordenar
        </button>
      </div>
    </div>
  )
}

// ─── AdicionaisPage ────────────────────────────────────────────────────────────

export function AdicionaisPage() {
  const { data: groups, isLoading, isError } = useAdditionals()
  const [search, setSearch] = useState('')
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const filteredGroups = (groups ?? []).filter((g) =>
    search.trim() ? g.name.toLowerCase().includes(search.toLowerCase()) : true
  )

  const selectedGroup =
    filteredGroups.find((g) => g.id === activeGroupId) ?? filteredGroups[0] ?? null

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* Search + New group */}
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
        <button className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 hover:border-red-400 px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
          Novo grupo
        </button>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Adicionais</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cadastre itens adicionais e ingredientes para os produtos.</p>
      </div>

      {isLoading && <p className="text-center text-sm text-gray-500 py-12">Carregando adicionais...</p>}
      {isError && <p className="text-center text-sm text-red-600 py-12">Erro ao carregar adicionais.</p>}

      {!isLoading && !isError && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredGroups.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>Nenhum grupo de adicionais encontrado.</p>
              <p className="text-xs mt-1">Adicione adicionais aos seus produtos para que apareçam aqui.</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex overflow-x-auto border-b border-gray-200 px-4 pt-2 gap-1">
                {filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                      selectedGroup?.id === group.id
                        ? 'border-red-500 text-red-500'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>

              {/* Active group content */}
              {selectedGroup && (
                <>
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="font-semibold text-gray-900 text-sm">{selectedGroup.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Disponível</span>
                      <ItemToggle
                        checked={selectedGroup.isActive}
                        onChange={() => {}}
                      />
                    </div>
                  </div>

                  <GroupContent groupId={selectedGroup.id} items={selectedGroup.items} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
