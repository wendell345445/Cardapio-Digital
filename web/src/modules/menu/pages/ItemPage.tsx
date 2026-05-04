import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Minus, X } from 'lucide-react'

import { useMenu } from '../hooks/useMenu'
import { useCartStore } from '../store/useCartStore'
import { ProductAddedPopup } from '../components/ProductAddedPopup'
import { SuspendedStorePage } from '../components/SuspendedStorePage'
import type { ProductVariation, ProductAdditional } from '../services/menu.service'

import { useStoreSlug } from '@/hooks/useStoreSlug'
import { resolveImageUrl } from '@/shared/lib/imageUrl'
import { toast } from '@/shared/lib/toast'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ItemPage() {
  const { productId } = useParams<{ productId: string }>()
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data } = useMenu(slug)

  const addItem = useCartStore((s) => s.addItem)
  const updateQty = useCartStore((s) => s.updateQty)
  const updateNotes = useCartStore((s) => s.updateNotes)
  const cartItems = useCartStore((s) => s.items)

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null)
  const [selectedAdditionals, setSelectedAdditionals] = useState<ProductAdditional[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [closedWarning, setClosedWarning] = useState(false)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  // Após "Adicionar", o item já entra no carrinho de fato. O popup mostra
  // quantidade/observação e edita o item recém-criado em tempo real
  // (qty++, qty--, digitar observação) via updateQty/updateNotes.
  const [addedItemId, setAddedItemId] = useState<string | null>(null)

  const product = data?.categories.flatMap((c) => c.products).find((p) => p.id === productId)
  const store = data?.store

  // Loja suspensa — bloqueia o item antes mesmo de procurar o produto.
  if (data?.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={data.store.name} />
  }

  if (!data || !product) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-menu-bg [font-family:'Sen',Helvetica] antialiased">
        <p className="text-menu-text">Produto não encontrado.</p>
      </div>
    )
  }

  const activeVariations = product.variations.filter((v) => v.isActive)
  const activeAdditionals = product.additionals.filter((a) => a.isActive)
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
  const addTotal = useMemo(
    () => selectedAdditionals.reduce((s, a) => s + a.price, 0),
    [selectedAdditionals]
  )
  const total = (basePrice + addTotal) * quantity

  function toggleAdditional(add: ProductAdditional) {
    setSelectedAdditionals((prev) =>
      prev.find((a) => a.id === add.id) ? prev.filter((a) => a.id !== add.id) : [...prev, add]
    )
  }

  function handleAdd() {
    if (!isOpen) {
      setClosedWarning(true)
      return
    }
    // Adiciona ao carrinho IMEDIATAMENTE (popup é só confirmação visual).
    // Guardamos o id retornado pra editar quantidade/observação em tempo real
    // dentro do popup, via updateQty/updateNotes.
    const id = addItem({
      productId: product!.id,
      productName: product!.name,
      imageUrl: product!.imageUrl,
      variationId: effectiveVariation?.id,
      variationName: effectiveVariation?.name,
      variationPrice: effectiveVariation?.price,
      additionals: selectedAdditionals.map((a) => ({ id: a.id, name: a.name, price: a.price })),
      quantity,
      unitPrice: hasActivePromo ? product!.promoPrice! : product!.basePrice ?? 0,
      notes: notes || undefined,
    })
    setAddedItemId(id)
  }

  function handleContinueShopping() {
    setAddedItemId(null)
    navigate('/')
  }

  function handleGoToCart() {
    setAddedItemId(null)
    navigate('/carrinho')
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    navigate('/')
  }

  const handleShare = async () => {
    const shareData = {
      title: product.name,
      text: product.description,
      url: window.location.href,
    }

    // Web Share API (mobile + macOS Safari + Edge moderno).
    // Só funciona em HTTPS ou localhost — em http://*.cardapio.test é
    // automaticamente undefined, então caímos no fallback de clipboard.
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        // AbortError = usuário cancelou no sheet nativo, não é erro real.
        if ((err as DOMException)?.name === 'AbortError') return
        // Outros erros caem no fallback abaixo.
      }
    }

    // Fallback: copia o link pra clipboard.
    try {
      await navigator.clipboard.writeText(shareData.url)
      toast.success('Link copiado!', 'Cole onde quiser compartilhar')
    } catch {
      toast.error('Não foi possível compartilhar', shareData.url)
    }
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg"
        style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}
      >
        {/* Hero */}
        <section className="relative bg-[#f3eeee]" aria-label="Imagem do produto">
          <div className="relative h-[320px] w-full overflow-hidden bg-[#f3eeee] sm:h-[420px] md:h-[460px]">
            {product.imageUrl ? (
              <img
                className="block h-full w-full object-cover"
                alt={product.name}
                src={resolveImageUrl(product.imageUrl)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-7xl text-gray-300">
                🍽️
              </div>
            )}

            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/28 to-transparent" />

            <div className="absolute left-4 right-4 top-5 flex items-center justify-between sm:left-6 sm:right-6">
              <button
                type="button"
                aria-label="Voltar"
                onClick={handleBack}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/90 text-menu-text shadow-[0_4px_14px_rgba(0,0,0,0.10)] backdrop-blur-sm transition-transform active:scale-95"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
              >
                {/* Chevron-left fininho — SVG idêntico ao MenuPanda */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M14.25 6.25L8.5 12L14.25 17.75"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                aria-label="Compartilhar produto"
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/90 text-menu-text shadow-[0_4px_14px_rgba(0,0,0,0.10)] backdrop-blur-sm transition-transform active:scale-95"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
              >
                {/* Share (3 nós conectados) outline — SVG idêntico ao MenuPanda */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08259 9.18042C7.54303 8.48035 6.69611 8.03 5.75 8.03C4.09315 8.03 2.75 9.37315 2.75 11.03C2.75 12.6869 4.09315 14.03 5.75 14.03C6.69636 14.03 7.54348 13.5794 8.08302 12.879L15.0218 16.6289C15.0074 16.7509 15 16.875 15 17.0008C15 18.6576 16.3431 20.0008 18 20.0008C19.6569 20.0008 21 18.6576 21 17.0008C21 15.3439 19.6569 14.0008 18 14.0008C17.0536 14.0008 16.2065 14.4514 15.667 15.1518L8.72823 11.4018C8.74263 11.2799 8.75 11.1558 8.75 11.03C8.75 10.9045 8.7423 10.7808 8.72734 10.6594L15.6674 6.84958C16.207 7.54965 17.0539 8 18 8Z"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {product.imageUrl && (
              <button
                type="button"
                aria-label="Ampliar imagem"
                onClick={() => setImagePreviewOpen(true)}
                className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-menu-text shadow-[0_4px_14px_rgba(0,0,0,0.10)] backdrop-blur-sm active:scale-95"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
              >
                {/* Maximize (4 cantos) — SVG idêntico ao MenuPanda */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M8 3H3V8M21 8V3H16M16 21H21V16M3 16V21H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-menu-primary" aria-hidden="true" />
          </div>
        </section>

        {/* Conteúdo */}
        <main className="bg-white px-4 pt-5 sm:px-6 md:px-8">
          <section aria-labelledby="product-title">
            <div className="flex items-start justify-between gap-3">
              <h1
                id="product-title"
                className="text-[20px] font-bold leading-[1.2] tracking-[-0.35px] text-menu-text"
              >
                {product.name}
              </h1>
              {!isOpen && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  ● Fechado
                </span>
              )}
            </div>

            {product.description && (
              <p className="mt-2.5 max-w-[540px] text-[12px] font-medium leading-[17px] tracking-[-0.18px] text-menu-text-muted">
                {product.description}
              </p>
            )}

            {hasActivePromo ? (
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-[14px] text-gray-400 line-through">{fmt(originalPrice)}</span>
                <span className="text-[20px] font-bold leading-[1.2] tracking-[-0.25px] text-menu-primary">
                  {fmt(basePrice)}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-[18px] font-bold leading-[1.2] tracking-[-0.25px] text-menu-text">
                {fmt(basePrice)}
              </p>
            )}
          </section>

          {/* Variações */}
          {activeVariations.length > 0 && (
            <section className="mt-8" aria-labelledby="variations-title">
              <div className="flex items-end justify-between gap-3 border-b border-menu-divider pb-3">
                <div>
                  <h2
                    id="variations-title"
                    className="text-[16px] font-bold leading-[1.2] tracking-[-0.25px] text-menu-text"
                  >
                    Tamanho / Variação
                  </h2>
                  <p className="mt-1.5 text-[11px] font-medium leading-[1.2] tracking-[-0.12px] text-menu-text-soft">
                    Obrigatório
                  </p>
                </div>
              </div>

              <div className="flex flex-col">
                {activeVariations.map((v) => {
                  const isSelected = effectiveVariation?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedVariation(v)}
                      className="flex min-h-[58px] items-center justify-between gap-3 border-b border-menu-divider py-3 text-left transition-opacity active:opacity-70"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected ? 'border-menu-primary' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="h-[10px] w-[10px] rounded-full bg-menu-primary" />
                          )}
                        </span>
                        <span className="block truncate text-[13px] font-semibold leading-[1.2] tracking-[-0.18px] text-menu-text">
                          {v.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-menu-primary">
                        {fmt(v.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Adicionais */}
          {activeAdditionals.length > 0 && (
            <section className="mt-8" aria-labelledby="additionals-title">
              <div className="flex items-end justify-between gap-3 border-b border-menu-divider pb-3">
                <div>
                  <h2
                    id="additionals-title"
                    className="text-[16px] font-bold leading-[1.2] tracking-[-0.25px] text-menu-text"
                  >
                    Complementos
                  </h2>
                  <p className="mt-1.5 text-[11px] font-medium leading-[1.2] tracking-[-0.12px] text-menu-text-soft">
                    Opcional
                  </p>
                </div>

                {selectedAdditionals.length > 0 && (
                  <span className="rounded-full bg-[#fff0f0] px-2.5 py-1 text-[10px] font-semibold text-menu-primary">
                    {selectedAdditionals.length} selecionado
                    {selectedAdditionals.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                {activeAdditionals.map((a) => {
                  const isSelected = !!selectedAdditionals.find((s) => s.id === a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleAdditional(a)}
                      className="flex min-h-[58px] items-center justify-between gap-3 border-b border-menu-divider py-3 text-left transition-opacity active:opacity-70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-[1.2] tracking-[-0.18px] text-menu-text-muted">
                          {a.name}
                        </span>
                        <span className="mt-1.5 block text-[12px] font-semibold leading-[1.2] tracking-[-0.12px] text-menu-text-soft">
                          +{fmt(a.price)}
                        </span>
                      </span>

                      {/* Botão circular: + vermelho quando solto, check branco em fundo vermelho quando selecionado */}
                      <span
                        className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full transition-all ${
                          isSelected ? 'bg-menu-primary' : 'bg-white'
                        }`}
                        style={{
                          border: isSelected
                            ? '0.6px solid rgba(239, 42, 48, 0.30)'
                            : '0.6px solid rgba(65, 57, 57, 0.16)',
                        }}
                      >
                        {isSelected ? (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path
                              d="M3.1 7.3L5.7 9.8L10.9 4.2"
                              stroke="white"
                              strokeWidth="2.1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 5V19M5 12H19"
                              stroke="#ef2a30"
                              strokeWidth="2.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Observações */}
          <section className="mt-8" aria-labelledby="notes-title">
            <h2
              id="notes-title"
              className="text-[16px] font-bold leading-[1.2] tracking-[-0.25px] text-menu-text"
            >
              Observações
            </h2>
            <p className="mt-1.5 text-[11px] font-medium leading-[1.2] tracking-[-0.12px] text-menu-text-soft">
              Algum detalhe pra cozinha?
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, etc."
              rows={2}
              className="mt-3 w-full resize-none rounded-[12px] border border-menu-card-border bg-white px-3 py-2.5 text-sm text-menu-text outline-none focus:border-menu-primary focus:ring-2 focus:ring-menu-primary/20"
              style={{ fontSize: 16 }}
            />
          </section>

          {closedWarning && !isOpen && (
            <div
              role="alert"
              className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              Loja fechada no momento.
              {store?.nextOpenLabel ? ` Abrimos ${store.nextOpenLabel}.` : ''}
            </div>
          )}
        </main>
      </div>

      {/* Footer sticky: card "total + qty pill" em cima, botão "Adicionar" cheio embaixo */}
      <footer
        className="fixed bottom-0 left-1/2 z-[48] w-full max-w-[768px] -translate-x-1/2 bg-gradient-to-t from-menu-bg via-menu-bg to-transparent px-4 pt-8 sm:px-6 md:px-8"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
      >
        <div
          className="mb-3 flex items-center justify-between rounded-[22px] bg-white px-4 py-3 shadow-[0_6px_22px_rgba(64,57,57,0.07)]"
          style={{ border: '0.6px solid rgba(65, 57, 57, 0.09)' }}
        >
          <output
            aria-label="Preço total"
            className="text-[20px] font-bold leading-[1.2] tracking-[-0.35px] text-menu-text"
          >
            {fmt(total)}
          </output>

          <div
            className="flex h-[30px] w-[86px] shrink-0 items-center justify-between rounded-full bg-menu-primary px-1.5 shadow-[0_3px_10px_rgba(239,42,48,0.18)]"
            role="group"
            aria-label="Controle de quantidade"
          >
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-[20px] w-[20px] items-center justify-center rounded-full text-white transition-transform active:scale-90"
            >
              <Minus className="h-3 w-3" strokeWidth={2.3} />
            </button>
            <span className="text-[13px] font-semibold leading-[1.2] text-white">{quantity}</span>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-[20px] w-[20px] items-center justify-center rounded-full text-white transition-transform active:scale-90"
            >
              <Plus className="h-3 w-3" strokeWidth={2.3} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          aria-label="Adicionar produto ao carrinho"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-menu-primary px-4 text-base font-bold text-white shadow-[0_6px_18px_rgba(239,42,48,0.22)] transition-all duration-200 active:scale-[0.99]"
        >
          {/* Sacola — SVG idêntico ao MenuPanda */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 2L3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6L18 2H6Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M3 6H21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path
              d="M16 10C16 12.2 14.2 14 12 14C9.8 14 8 12.2 8 10"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          Adicionar
        </button>
      </footer>

      {addedItemId && (() => {
        // Lê o item recém-criado do cart store. Tudo (qty, observação) é
        // editado via update*, então o popup sempre reflete o estado atual.
        const cartItem = cartItems.find((i) => i.id === addedItemId)
        if (!cartItem) return null
        return (
          <ProductAddedPopup
            productName={product.name}
            quantity={cartItem.quantity}
            observation={cartItem.notes ?? ''}
            onObservationChange={(v) => updateNotes(addedItemId, v)}
            onDecreaseQuantity={() => updateQty(addedItemId, cartItem.quantity - 1)}
            onIncreaseQuantity={() => updateQty(addedItemId, cartItem.quantity + 1)}
            onContinueShopping={handleContinueShopping}
            onGoToCart={handleGoToCart}
          />
        )
      })()}

      {/* Image preview lightbox */}
      {imagePreviewOpen && product.imageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4"
          onClick={() => setImagePreviewOpen(false)}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setImagePreviewOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={resolveImageUrl(product.imageUrl)}
            alt={product.name}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  )
}
