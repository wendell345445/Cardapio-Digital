import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import type { Product, ProductVariation, ProductAdditional } from '../services/menu.service'

import { resolveImageUrl } from '@/shared/lib/imageUrl'

interface Props {
  product: Product
  onClose: () => void
}

export function ProductModal({ product, onClose }: Props) {
  const addItem = useCartStore(s => s.addItem)
  const activeVariations = product.variations.filter(v => v.isActive)
  const activeAdditionals = product.additionals.filter(a => a.isActive)

  const cheapestVariation = activeVariations.length > 0
    ? activeVariations.reduce((a, b) => a.price < b.price ? a : b)
    : null

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(cheapestVariation)
  const [selectedAdditionals, setSelectedAdditionals] = useState<ProductAdditional[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const toggleAdditional = (add: ProductAdditional) => {
    setSelectedAdditionals(prev =>
      prev.find(a => a.id === add.id)
        ? prev.filter(a => a.id !== add.id)
        : [...prev, add]
    )
  }

  // Promo só se aplica quando não há variações selecionadas (variation tem preço próprio).
  const hasActivePromo =
    !selectedVariation &&
    product.promoPrice != null &&
    product.basePrice != null &&
    product.promoPrice < product.basePrice

  const effectiveUnit = hasActivePromo
    ? product.promoPrice!
    : (selectedVariation?.price ?? product.basePrice ?? 0)
  const addTotal = selectedAdditionals.reduce((s, a) => s + a.price, 0)
  const total = (effectiveUnit + addTotal) * quantity

  const handleAdd = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      variationId: selectedVariation?.id,
      variationName: selectedVariation?.name,
      variationPrice: selectedVariation?.price,
      additionals: selectedAdditionals.map(a => ({ id: a.id, name: a.name, price: a.price })),
      quantity,
      unitPrice: hasActivePromo ? product.promoPrice! : product.basePrice ?? 0,
      notes: notes || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 pr-8">{product.name}</h2>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Image */}
        {product.imageUrl && (
          <img src={resolveImageUrl(product.imageUrl)} alt={product.name} className="w-full h-48 object-cover" />
        )}

        <div className="p-4 space-y-5">
          {/* Description */}
          {product.description && <p className="text-gray-500 text-sm">{product.description}</p>}

          {/* Variations */}
          {activeVariations.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Tamanho</h3>
              <div className="space-y-2">
                {activeVariations.map(v => (
                  <label
                    key={v.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer min-h-[44px]"
                    style={{ borderColor: selectedVariation?.id === v.id ? '#22c55e' : '#e5e7eb' }}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variation"
                        checked={selectedVariation?.id === v.id}
                        onChange={() => setSelectedVariation(v)}
                        className="accent-green-500"
                      />
                      <span className="text-sm font-medium">{v.name}</span>
                    </span>
                    <span className="text-sm text-green-600 font-semibold">
                      {v.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Additionals */}
          {activeAdditionals.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Adicionais</h3>
              <div className="space-y-2">
                {activeAdditionals.map(a => (
                  <label key={a.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer min-h-[44px]">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selectedAdditionals.find(s => s.id === a.id)}
                        onChange={() => toggleAdditional(a)}
                        className="accent-green-500"
                      />
                      <span className="text-sm font-medium">{a.name}</span>
                    </span>
                    <span className="text-sm text-green-600 font-semibold">
                      +{a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Observações</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Alguma observação? Ex: sem cebola"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ fontSize: 16 }}
            />
          </section>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-gray-300 text-gray-600"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center font-bold text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-green-500 text-white"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t p-4">
          <button
            onClick={handleAdd}
            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-base flex items-center justify-between px-4 min-h-[44px]"
          >
            <span>Adicionar ao carrinho</span>
            <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
