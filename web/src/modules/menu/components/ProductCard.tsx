import { Plus } from 'lucide-react'

import { type Product } from '../services/menu.service'
import { useCartStore } from '../store/useCartStore'

import { resolveImageUrl } from '@/shared/lib/imageUrl'

interface Props {
  product: Product
  slug: string
  onNavigate: () => void
}

function getCloudinaryUrl(url: string): string {
  const resolved = resolveImageUrl(url) ?? url
  if (!resolved.includes('cloudinary.com')) return resolved
  return resolved.replace('/upload/', '/upload/f_auto,w_auto/')
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ProductCard({ product, onNavigate }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const hasVariations = product.variations.filter((v) => v.isActive).length > 0
  const hasAdditionals = product.additionals.filter((a) => a.isActive).length > 0
  const displayPrice = hasVariations
    ? Math.min(...product.variations.filter((v) => v.isActive).map((v) => v.price))
    : product.basePrice

  // Promo por produto só se aplica quando não há variations.
  const hasActivePromo =
    !hasVariations &&
    product.promoPrice != null &&
    displayPrice != null &&
    product.promoPrice < displayPrice

  // Quick-add: só aplica se o produto não tem variação nem adicional. Caso
  // contrário precisa abrir a página do produto pra cliente escolher.
  const canQuickAdd = !hasVariations && !hasAdditionals && product.basePrice != null

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canQuickAdd) {
      onNavigate()
      return
    }
    const unitPrice = hasActivePromo ? product.promoPrice! : product.basePrice ?? 0
    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      additionals: [],
      quantity: 1,
      unitPrice,
    })
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onNavigate()
        }
      }}
      className="relative min-h-[111px] w-full cursor-pointer rounded-[14px] border border-menu-card-border bg-white p-3 pr-[124px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-transform active:scale-[0.99]"
      aria-label={`Ver detalhes de ${product.name}`}
    >
      <h3 className="line-clamp-1 text-[15px] font-bold leading-[1.25] tracking-[-0.4px] text-[#2e2828]">
        {product.name}
      </h3>

      {product.description && (
        <p className="mt-2 line-clamp-2 max-w-[190px] text-[10px] font-normal leading-[1.45] tracking-[-0.2px] text-menu-text-soft">
          {product.description}
        </p>
      )}

      <div className="mt-4">
        {hasActivePromo ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-gray-400 line-through">{fmtBRL(displayPrice!)}</span>
            <span className="whitespace-nowrap text-[17px] font-bold leading-none tracking-[-0.5px] text-menu-primary">
              {fmtBRL(product.promoPrice!)}
            </span>
          </div>
        ) : displayPrice != null ? (
          <span className="whitespace-nowrap text-[17px] font-bold leading-none tracking-[-0.5px] text-[#4a4a4a]">
            {hasVariations ? 'A partir de ' : ''}
            {fmtBRL(displayPrice)}
          </span>
        ) : null}
      </div>

      <div className="absolute right-[10px] top-[10px] h-[91px] w-[105px] overflow-hidden rounded-[10px] bg-[#f3eeee]">
        {product.imageUrl ? (
          <img
            className="h-full w-full object-cover"
            alt={product.name}
            src={getCloudinaryUrl(product.imageUrl)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">
            🍽️
          </div>
        )}
        <button
          type="button"
          aria-label={canQuickAdd ? `Adicionar ${product.name} ao carrinho` : `Ver opções de ${product.name}`}
          onClick={handleQuickAdd}
          className="absolute bottom-[6px] right-[6px] flex h-5 w-5 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(239,42,48,0.35)] transition-transform active:scale-90"
          style={{ background: 'linear-gradient(135deg,#f53b3b 0%,#c91f25 100%)' }}
        >
          <Plus className="h-[10px] w-[10px] text-white" strokeWidth={3} />
        </button>
      </div>
    </article>
  )
}
