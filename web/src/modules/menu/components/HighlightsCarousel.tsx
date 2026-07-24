import { type Product } from '../services/menu.service'

import { ProductCard } from './ProductCard'

interface Props {
  products: Product[]
  slug: string
  onNavigate: (productId: string) => void
}

// Seção "Destaques" — carrossel horizontal no topo do cardápio, acima das
// categorias. Reaproveita o ProductCard (que já herda as cores da marca via
// CSS vars). Some ao buscar/filtrar por categoria (controlado pela MenuPage).
export function HighlightsCarousel({ products, slug, onNavigate }: Props) {
  if (products.length === 0) return null

  return (
    <section className="relative z-0 mt-4" aria-labelledby="destaques-heading">
      <div className="flex w-fit flex-col gap-[5px]">
        <h2
          id="destaques-heading"
          className="text-xl font-semibold leading-none tracking-[-0.33px] text-[#574f4f]"
        >
          🔥 Destaques
        </h2>
        <div className="ml-[1.5px] h-0.5 w-[calc(100%-1.5px)] rounded-full bg-menu-primary" />
      </div>

      <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div key={product.id} className="w-[280px] shrink-0 snap-start">
            <ProductCard
              product={product}
              slug={slug}
              onNavigate={() => onNavigate(product.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
