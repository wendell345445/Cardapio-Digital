import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'

import type { Product } from '../../services/products.service'

import { useAdminCartStore } from '@/modules/admin/store/useAdminCartStore'
import { resolveImageUrl } from '@/shared/lib/imageUrl'

// ─── PDV: configura um produto antes de adicionar ao carrinho ────────────────
// Variação (radio), adicionais (checkbox), quantidade e observação. Espelha o
// que o cliente faz no cardápio, mas escrito do zero pra store admin.

interface Props {
  product: Product
  onClose: () => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PdvItemModal({ product, onClose }: Props) {
  const addItem = useAdminCartStore((s) => s.addItem)

  const activeVariations = useMemo(
    () => product.variations.filter((v) => v.isActive),
    [product.variations]
  )
  const activeAddons = useMemo(
    () => product.addons.filter((l) => l.addon.isActive),
    [product.addons]
  )

  const [variationId, setVariationId] = useState<string | undefined>(
    activeVariations[0]?.id
  )
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  // Produto com variação não aplica promo (variação tem preço próprio); sem
  // variação, usa basePrice (não há campo de promo no shape admin).
  const unitPrice = variationId
    ? activeVariations.find((v) => v.id === variationId)?.price ?? 0
    : product.basePrice ?? 0

  const addonsTotal = activeAddons
    .filter((l) => selectedAddons.has(l.addonId))
    .reduce((s, l) => s + l.addon.price, 0)

  const lineTotal = (unitPrice + addonsTotal) * quantity

  // Bloqueia scroll do fundo enquanto aberto.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function toggleAddon(id: string) {
    setSelectedAddons((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAdd() {
    const variation = activeVariations.find((v) => v.id === variationId)
    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      variationId,
      variationName: variation?.name,
      unitPrice,
      addons: activeAddons
        .filter((l) => selectedAddons.has(l.addonId))
        .map((l) => ({ id: l.addonId, name: l.addon.name, price: l.addon.price })),
      quantity,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  const img = resolveImageUrl(product.imageUrl)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-gray-100">
          {img && (
            <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeVariations.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tamanho / variação</p>
              <div className="space-y-1.5">
                {activeVariations.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        name="variation"
                        checked={variationId === v.id}
                        onChange={() => setVariationId(v.id)}
                        className="accent-red-500"
                      />
                      {v.name}
                    </span>
                    <span className="text-sm text-gray-600">{fmt(v.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeAddons.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Adicionais</p>
              <div className="space-y-1.5">
                {activeAddons.map((l) => (
                  <label
                    key={l.addonId}
                    className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={selectedAddons.has(l.addonId)}
                        onChange={() => toggleAddon(l.addonId)}
                        className="accent-red-500"
                      />
                      {l.addon.name}
                    </span>
                    <span className="text-sm text-gray-600">+ {fmt(l.addon.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Observação</p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-2.5 py-2 text-gray-500 hover:text-gray-700"
              aria-label="Diminuir quantidade"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center text-sm font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="px-2.5 py-2 text-gray-500 hover:text-gray-700"
              aria-label="Aumentar quantidade"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Adicionar
            <span className="font-semibold">{fmt(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
