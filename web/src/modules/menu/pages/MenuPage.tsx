import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Phone, MapPin, Clock, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react'

import { useMenu } from '../hooks/useMenu'
import { ProductCard } from '../components/ProductCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import { FacebookPixel } from '../components/FacebookPixel'
import { CookieBanner, hasCookieConsent } from '../components/CookieBanner'
import { SuspendedStorePage } from '../components/SuspendedStorePage'
import { useCartStore } from '../store/useCartStore'

import { useStoreSlug } from '@/hooks/useStoreSlug'

export function MenuPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data, isLoading } = useMenu(slug)

  const setStore = useCartStore(s => s.setStore)
  const cartItems = useCartStore(s => s.items)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showHours, setShowHours] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => {
    if (slug && slug !== '__custom_domain__') setStore(slug)
  }, [slug, setStore])

  const allProducts = useMemo(() => {
    if (!data) return []
    return data.categories.flatMap(c => c.products)
  }, [data])

  const filteredProducts = useMemo(() => {
    if (search.trim()) {
      return allProducts.filter(
        p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (activeCategoryId) {
      return data?.categories.find(c => c.id === activeCategoryId)?.products ?? []
    }
    return allProducts
  }, [allProducts, search, activeCategoryId, data?.categories])

  // Which categories to show in the grid (sections)
  const visibleCategories = useMemo(() => {
    if (!data) return []
    if (search.trim() || activeCategoryId) return []
    return data.categories.filter(c => c.isActive)
  }, [data, search, activeCategoryId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-800">
        <div className="h-48 bg-gradient-to-b from-amber-900 to-amber-700" />
        <div className="px-4 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cardápio não encontrado.</p>
      </div>
    )
  }

  // Loja suspensa — bloqueia o cardápio inteiro (Option B). O backend ainda retorna
  // os produtos no payload, mas escondemos tudo aqui no frontend pra não dar a falsa
  // impressão de loja operando. A criação de pedido também é bloqueada no backend.
  if (data.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={data.store.name} />
  }

  const { store, categories } = data
  const isOpen = store.storeStatus === 'open'
  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="min-h-screen bg-gray-50">
      {store.facebookPixelId && hasCookieConsent() && (
        <FacebookPixel pixelId={store.facebookPixelId} />
      )}

      {/* Background gradient header */}
      <div className="bg-gradient-to-b from-amber-900 to-amber-700 h-48 w-full" />

      {/* Store card — floats over gradient */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg -mt-24 mx-0 p-5 relative z-10">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              {store.logo ? (
                <img
                  src={store.logo}
                  alt={store.name}
                  className="w-16 h-16 rounded-xl object-cover border border-gray-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-amber-100 flex items-center justify-center text-3xl">
                  🍔
                </div>
              )}
            </div>

            {/* Store info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Cardápio digital
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isOpen
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isOpen ? '● Aberto agora' : '● Fechado'}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
              {store.description && (
                <p className="text-sm text-gray-500 mt-0.5">{store.description}</p>
              )}
            </div>
          </div>

          {/* Store details row */}
          <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
            {store.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                {store.phone}
              </span>
            )}
            {store.address && (
              <span className="flex items-center gap-1.5 truncate max-w-xs">
                <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="truncate">{store.address}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Recebimento pedidos
            </span>
          </div>

          {/* Ver horários */}
          {(store.businessHours?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowHours(v => !v)}
                className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium"
              >
                Ver horários
                {showHours ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHours && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {store.businessHours?.map(h => (
                    <div key={h.dayOfWeek} className="text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                      <span className="font-medium text-gray-700">{DAY_NAMES[h.dayOfWeek]}</span>
                      {h.isClosed ? (
                        <p className="text-red-500">Fechado</p>
                      ) : (
                        <p className="text-gray-500">{h.openTime} – {h.closeTime}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar pratos, combos e bebidas"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ fontSize: 16 }}
          />
        </div>

        {/* Category pills */}
        {!search && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategoryId === null
                  ? 'bg-amber-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategoryId === cat.id
                    ? 'bg-amber-800 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Product content */}
        <main className="mt-4 pb-32">
          {/* Search results — flat grid */}
          {(search.trim() || activeCategoryId) && (
            <>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p>Nenhum produto encontrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      slug={slug ?? ''}
                      onNavigate={() => navigate(`/produto/${product.id}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Default view — sections per category */}
          {!search.trim() && !activeCategoryId && (
            <div className="space-y-8">
              {visibleCategories.map(cat => (
                <section key={cat.id}>
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                      Seção
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
                    <p className="text-sm text-gray-500">Confira os itens disponíveis desta categoria</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cat.products.length} itens</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cat.products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        slug={slug ?? ''}
                        onNavigate={() => navigate(`/produto/${product.id}`)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {visibleCategories.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p>Cardápio vazio no momento.</p>
                </div>
              )}
            </div>
          )}
        </main>
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
      <CookieBanner />
    </div>
  )
}
