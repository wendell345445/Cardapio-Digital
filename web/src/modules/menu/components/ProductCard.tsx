import { Plus } from 'lucide-react'

import { type Product } from '../services/menu.service'

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
  const hasVariations = product.variations.filter(v => v.isActive).length > 0
  const displayPrice = hasVariations
    ? Math.min(...product.variations.filter(v => v.isActive).map(v => v.price))
    : product.basePrice

  // Promo por produto só se aplica quando não há variations (não tem como
  // um preço promocional único substituir múltiplas variações de preço).
  const hasActivePromo =
    !hasVariations &&
    product.promoPrice != null &&
    displayPrice != null &&
    product.promoPrice < displayPrice

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group relative"
      onClick={onNavigate}
    >
      {/* Image */}
      <div className="w-full aspect-square bg-gray-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={getCloudinaryUrl(product.imageUrl)}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">
            🍽️
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 pb-10">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
        {displayPrice !== undefined && displayPrice !== null && (
          hasActivePromo ? (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xs text-gray-400 line-through">{fmtBRL(displayPrice)}</span>
              <span className="font-bold text-red-600 text-sm">
                {fmtBRL(product.promoPrice!)}
              </span>
            </div>
          ) : (
            <p className="mt-2 font-bold text-gray-800 text-sm">
              {hasVariations ? 'A partir de ' : ''}
              {fmtBRL(displayPrice)}
            </p>
          )
        )}
      </div>

      {/* Add button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onNavigate()
        }}
        className="absolute bottom-3 right-3 w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
        aria-label="Adicionar ao carrinho"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}
