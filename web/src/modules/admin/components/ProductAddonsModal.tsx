import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

import { useAddonCategories, useSetProductAddons } from '../hooks/useAdditionals'

// ─── v2.9: Modal de vinculo Produto ↔ Adicionais ─────────────────────────────
// Lista todas as AddonCategory + Addon da loja em tabs. Marca/desmarca via
// checkbox. Ao salvar, manda PUT /admin/additionals/products/:id com o set
// completo de addonIds selecionados.

interface Props {
  open: boolean
  productId: string
  productName: string
  /** IDs dos addons já vinculados ao produto (pré-marcados). */
  initialAddonIds: string[]
  onClose: () => void
  onSaved?: () => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ProductAddonsModal({ open, productId, productName, initialAddonIds, onClose, onSaved }: Props) {
  const { data: categories, isLoading } = useAddonCategories()
  const setProductAddons = useSetProductAddons()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialAddonIds))
      setSearch('')
    }
  }, [open, initialAddonIds])

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    if (!search.trim()) return categories
    const term = search.toLowerCase()
    return categories
      .map((c) => ({ ...c, addons: c.addons.filter((a) => a.name.toLowerCase().includes(term)) }))
      .filter((c) => c.addons.length > 0)
  }, [categories, search])

  const activeCategory =
    filteredCategories.find((c) => c.id === activeCategoryId) ?? filteredCategories[0] ?? null

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    setProductAddons.mutate(
      { productId, addonIds: Array.from(selected) },
      {
        onSuccess: () => {
          onSaved?.()
          onClose()
        },
      }
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="min-h-full flex items-start justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl my-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Seleção de adicionais</h2>
            <p className="text-xs text-gray-500 mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar adicional..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-10 text-sm text-gray-500">Carregando...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-sm text-gray-500 text-center">
            <p>Nenhuma categoria de adicional cadastrada.</p>
            <p className="text-xs mt-1">
              Cadastre adicionais em <span className="font-medium">Adicionais</span> no menu lateral pra vincular aqui.
            </p>
          </div>
        ) : (
          <>
            <div className="flex overflow-x-auto border-b border-gray-200 px-6 pt-2 gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                    activeCategory?.id === cat.id
                      ? 'border-red-500 text-red-500'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="px-6 py-3">
              {activeCategory && activeCategory.addons.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum adicional nessa categoria.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activeCategory?.addons.map((addon) => (
                    <label key={addon.id} className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded">
                      {addon.imageUrl ? (
                        <img src={addon.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">
                          📷
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{addon.name}</p>
                        {!addon.isActive && (
                          <p className="text-xs text-amber-600">Indisponível</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">{fmt(addon.price)}</span>
                      <input
                        type="checkbox"
                        checked={selected.has(addon.id)}
                        onChange={() => toggle(addon.id)}
                        className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {selected.size} {selected.size === 1 ? 'adicional vinculado' : 'adicionais vinculados'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={setProductAddons.isPending}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {setProductAddons.isPending ? 'Salvando...' : 'Salvar Adicionais'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
