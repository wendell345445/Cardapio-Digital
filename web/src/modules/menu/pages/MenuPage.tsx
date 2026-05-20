import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useMenu } from '../hooks/useMenu'
import { useTableMode } from '../hooks/useTableMode'
import { ProductCard } from '../components/ProductCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { FacebookPixel } from '../components/FacebookPixel'
import { ThemeInjector } from '../components/ThemeInjector'
import { CookieBanner, hasCookieConsent } from '../components/CookieBanner'
import { SuspendedStorePage } from '../components/SuspendedStorePage'
import { StoreHeader } from '../components/StoreHeader'
import { StoreInfo } from '../components/StoreInfo'
import { SearchBar } from '../components/SearchBar'
import { CategoryChips } from '../components/CategoryChips'
import { CartSummaryBar } from '../components/CartSummaryBar'
import { BottomNavigation } from '../components/BottomNavigation'
import { useCartStore } from '../store/useCartStore'

import { useStoreSlug } from '@/hooks/useStoreSlug'
import { toast } from '@/shared/lib/toast'

export function MenuPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data, isLoading } = useMenu(slug)

  const setStore = useCartStore((s) => s.setStore)
  // Modo mesa só vale na aba que veio do QR (`/mesa/:token`).
  const { tableNumber, isTableMode } = useTableMode()
  const cartItems = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (slug && slug !== '__custom_domain__') setStore(slug)
  }, [slug, setStore])

  const allProducts = useMemo(() => {
    if (!data) return []
    return data.categories.flatMap((c) => c.products)
  }, [data])

  const filteredProducts = useMemo(() => {
    if (search.trim()) {
      return allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (activeCategoryId) {
      return data?.categories.find((c) => c.id === activeCategoryId)?.products ?? []
    }
    return allProducts
  }, [allProducts, search, activeCategoryId, data?.categories])

  const visibleCategories = useMemo(() => {
    if (!data) return []
    if (search.trim() || activeCategoryId) return []
    return data.categories.filter((c) => c.isActive)
  }, [data, search, activeCategoryId])

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-menu-bg [font-family:'Sen',Helvetica] antialiased">
        <div className="h-[49px] bg-gradient-to-r from-menu-gradient-from to-menu-gradient-to" />
        <div className="mx-auto grid max-w-[768px] grid-cols-1 gap-3 px-4 pt-5 sm:grid-cols-2 sm:px-6 md:px-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center [font-family:'Sen',Helvetica] antialiased">
        <p className="text-gray-500">Cardápio não encontrado.</p>
      </div>
    )
  }

  // Loja suspensa — bloqueia o cardápio inteiro (Option B). O backend ainda
  // retorna os produtos, mas escondemos no frontend pra não dar a falsa
  // impressão de loja operando.
  if (data.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={data.store.name} />
  }

  const { store, categories } = data
  const isOpen = store.storeStatus === 'open'

  const categoryOptions = [
    { id: null, name: 'Todos' },
    ...categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name })),
  ]

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      {store.facebookPixelId && hasCookieConsent() && (
        <FacebookPixel pixelId={store.facebookPixelId} />
      )}
      <ThemeInjector primaryColor={store.primaryColor} secondaryColor={store.secondaryColor} />


      <div
        className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg"
        style={{ paddingBottom: `calc(${cartCount > 0 ? 152 : 86}px + env(safe-area-inset-bottom))` }}
      >
        <StoreHeader
          storeName={store.name}
          onShareClick={async () => {
            const shareData = {
              title: store.name,
              text: store.description,
              url: window.location.href,
            }
            if (navigator.share) {
              try {
                await navigator.share(shareData)
                return
              } catch (err) {
                if ((err as DOMException)?.name === 'AbortError') return
              }
            }
            try {
              await navigator.clipboard.writeText(shareData.url)
              toast.success('Link copiado!', 'Cole onde quiser compartilhar')
            } catch {
              toast.error('Não foi possível compartilhar', shareData.url)
            }
          }}
        />

        <main className="w-full flex-1 px-4 pt-5 sm:px-6 md:px-8">
          <StoreInfo
            name={store.name}
            address={store.address}
            isOpen={isOpen}
            nextOpenLabel={store.nextOpenLabel}
            tableNumber={tableNumber}
          />

          <SearchBar value={search} onChange={setSearch} placeholder="Pesquisar" />

          {!search.trim() && (
            <CategoryChips
              categories={categoryOptions}
              activeId={activeCategoryId}
              onSelect={setActiveCategoryId}
            />
          )}

          {/* Resultados de busca ou categoria filtrada — grid plano */}
          {(search.trim() || activeCategoryId) && (
            <section className="relative z-0 mt-4">
              {filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <p>Nenhum produto encontrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      slug={slug ?? ''}
                      onNavigate={() => navigate(`/produto/${product.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Visão padrão — sessões por categoria */}
          {!search.trim() && !activeCategoryId && (
            <div className="space-y-8">
              {visibleCategories.map((cat) => (
                <section key={cat.id} className="relative z-0" aria-labelledby={`cat-${cat.id}`}>
                  <div className="flex w-fit flex-col gap-[5px]">
                    <h2
                      id={`cat-${cat.id}`}
                      className="text-xl font-semibold leading-none tracking-[-0.33px] text-[#574f4f]"
                    >
                      {cat.name}
                    </h2>
                    <div className="ml-[1.5px] h-0.5 w-[calc(100%-1.5px)] rounded-full bg-menu-primary" />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cat.products.map((product) => (
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
                <div className="py-16 text-center text-gray-400">
                  <p>Cardápio vazio no momento.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <CartSummaryBar
        quantity={cartCount}
        total={subtotal()}
        onClick={() => navigate('/carrinho')}
      />

      <BottomNavigation
        cartQuantity={cartCount}
        onCartClick={() => navigate('/carrinho')}
        tableMode={isTableMode}
      />

      <CookieBanner />
    </div>
  )
}
