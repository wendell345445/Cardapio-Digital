import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react'

import { useMenu } from '../hooks/useMenu'
import { useCartStore } from '../store/useCartStore'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import { SuspendedStorePage } from '../components/SuspendedStorePage'
import type { ProductVariation, ProductAdditional } from '../services/menu.service'

import { useStoreSlug } from '@/hooks/useStoreSlug'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ItemPage() {
  const { productId } = useParams<{ productId: string }>()
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data } = useMenu(slug)

  const addItem = useCartStore(s => s.addItem)
  const cartItems = useCartStore(s => s.items)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null)
  const [selectedAdditionals, setSelectedAdditionals] = useState<ProductAdditional[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const product = data?.categories.flatMap(c => c.products).find(p => p.id === productId)
  const store = data?.store

  // Loja suspensa — bloqueia o item antes mesmo de procurar o produto (Option B).
  if (data?.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={data.store.name} />
  }

  if (!data || !product) {
    return (
      <div className="min-h-screen bg-amber-800 flex items-center justify-center">
        <p className="text-white">Produto não encontrado.</p>
      </div>
    )
  }

  const activeVariations = product.variations.filter(v => v.isActive)
  const activeAdditionals = product.additionals.filter(a => a.isActive)
  const isOpen = store?.storeStatus === 'open'

  const effectiveVariation = selectedVariation ?? (activeVariations.length > 0 ? activeVariations[0] : null)

  const hasActivePromo =
    !effectiveVariation &&
    product.promoPrice != null &&
    product.basePrice != null &&
    product.promoPrice < product.basePrice
  const basePrice = hasActivePromo
    ? product.promoPrice!
    : (effectiveVariation?.price ?? product.basePrice ?? 0)
  const originalPrice = effectiveVariation?.price ?? product.basePrice ?? 0
  const addTotal = selectedAdditionals.reduce((s, a) => s + a.price, 0)
  const total = (basePrice + addTotal) * quantity

  function toggleAdditional(add: ProductAdditional) {
    setSelectedAdditionals(prev =>
      prev.find(a => a.id === add.id)
        ? prev.filter(a => a.id !== add.id)
        : [...prev, add]
    )
  }

  function handleAdd() {
    addItem({
      productId: product!.id,
      productName: product!.name,
      imageUrl: product!.imageUrl,
      variationId: effectiveVariation?.id,
      variationName: effectiveVariation?.name,
      variationPrice: effectiveVariation?.price,
      additionals: selectedAdditionals.map(a => ({ id: a.id, name: a.name, price: a.price })),
      quantity,
      unitPrice: hasActivePromo ? product!.promoPrice! : product!.basePrice ?? 0,
      notes: notes || undefined,
    })
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background gradient */}
      <div className="bg-gradient-to-b from-amber-900 to-amber-700 h-32 w-full" />

      {/* Store mini header */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg -mt-16 p-4 relative z-10 flex items-center gap-3">
          {store?.logo ? (
            <img src={store.logo} alt={store.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🍔</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Detalhes do item</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isOpen ? '● Aberto agora' : '● Fechado'}
              </span>
            </div>
            <p className="font-bold text-gray-900 truncate">{store?.name}</p>
            <p className="text-xs text-gray-400">Faça seu pedido online</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao cardápio
          </button>
        </div>

        {/* Product card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-4 overflow-hidden pb-6">
          {/* Product header */}
          <div className="px-5 pt-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Produto selecionado
            </p>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                activeAdditionals.length > 0
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {activeAdditionals.length > 0 ? 'Com adicionais' : 'Sem adicionais'}
              </span>
            </div>
          </div>

          {/* Image */}
          {product.imageUrl ? (
            <div className="mt-4 mx-5 rounded-xl overflow-hidden bg-gray-100">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full object-cover"
                style={{ maxHeight: '300px' }}
              />
            </div>
          ) : (
            <div className="mt-4 mx-5 rounded-xl bg-gray-100 h-48 flex items-center justify-center text-6xl text-gray-200">
              🍽️
            </div>
          )}

          <div className="px-5 mt-4 space-y-5">
            {/* Name + price + description */}
            <div>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{product.name}</p>
                {hasActivePromo ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-gray-400 line-through">{fmt(originalPrice)}</span>
                    <span className="font-bold text-red-600 text-lg">{fmt(basePrice)}</span>
                  </div>
                ) : (
                  <p className="font-bold text-red-500 text-lg">{fmt(basePrice)}</p>
                )}
              </div>
              {product.description && (
                <p className="text-sm text-gray-500 mt-1">{product.description}</p>
              )}
            </div>

            {/* Variations */}
            {activeVariations.length > 0 && (
              <section>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Tamanho / Variação</h3>
                <div className="space-y-2">
                  {activeVariations.map(v => (
                    <label
                      key={v.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer"
                      style={{ borderColor: (effectiveVariation?.id === v.id) ? '#EF4444' : '#e5e7eb' }}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variation"
                          checked={effectiveVariation?.id === v.id}
                          onChange={() => setSelectedVariation(v)}
                          className="accent-red-500"
                        />
                        <span className="text-sm font-medium">{v.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-red-500">{fmt(v.price)}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Additionals */}
            {activeAdditionals.length > 0 && (
              <section>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Adicionais</h3>
                <div className="space-y-2">
                  {activeAdditionals.map(a => (
                    <label key={a.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer border-gray-100">
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedAdditionals.find(s => s.id === a.id)}
                          onChange={() => toggleAdditional(a)}
                          className="accent-red-500"
                        />
                        <span className="text-sm font-medium">{a.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-600">+{fmt(a.price)}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Observações */}
            <section>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Observações</h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Alguma observação? Ex: sem cebola"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ fontSize: 16 }}
              />
            </section>

            {/* Quantity + CTA */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center font-bold text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-800 text-white hover:bg-amber-900"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAdd}
                className="flex-1 bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-xl flex items-center justify-between px-4 transition-colors"
              >
                <span>Adicionar · {fmt(total)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cart */}
      {cartCount > 0 && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-full shadow-lg flex items-center gap-2 z-40 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          Carrinho ({cartCount})
        </button>
      )}

      <CheckoutDrawer open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  )
}
