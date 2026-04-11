import { Plus } from 'lucide-react'
import { type Product } from '../services/menu.service'

interface Props {
  product: Product
  slug: string
  onNavigate: () => void
}

function getCloudinaryUrl(url: string): string {
  if (!url.includes('cloudinary.com')) return url
  return url.replace('/upload/', '/upload/f_auto,w_auto/')
}

export function ProductCard({ product, onNavigate }: Props) {
  const hasVariations = product.variations.filter(v => v.isActive).length > 0
  const displayPrice = hasVariations
    ? Math.min(...product.variations.filter(v => v.isActive).map(v => v.price))
    : product.basePrice

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
          <p className="mt-2 font-bold text-gray-800 text-sm">
            {hasVariations ? 'A partir de ' : ''}
            {displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
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
