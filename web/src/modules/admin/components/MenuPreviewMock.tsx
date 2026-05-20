import { StoreAvatar } from '@/shared/components/StoreAvatar'
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, readableTextColor } from '@/shared/lib/theme'

interface MenuPreviewMockProps {
  storeName: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

/**
 * Mockup estático do cardápio público — usado na aba "Personalização" pra mostrar
 * em tempo real o efeito das cores escolhidas, sem bater na API. Não é uma
 * réplica perfeita do MenuPage, é um resumo (header + 1 categoria + 2 cards +
 * CTA) que reflete o uso real das cores primária/secundária.
 */
export function MenuPreviewMock({
  storeName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: MenuPreviewMockProps) {
  const primary = primaryColor || DEFAULT_PRIMARY
  const secondary = secondaryColor || DEFAULT_SECONDARY
  const textOnPrimary = readableTextColor(primary)

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {/* Frame estilo celular (header + tag "Preview") */}
      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">Preview do cardápio</span>
        <span className="text-[10px] text-gray-400">só visual</span>
      </div>

      <div className="bg-white">
        {/* Header da loja */}
        <div
          className="px-4 py-5 flex items-center gap-3 border-b border-gray-100"
          style={{ backgroundColor: secondary }}
        >
          <StoreAvatar
            name={storeName}
            logoUrl={logoUrl}
            fallbackBg={primary}
            size={48}
            className="shrink-0 ring-2 ring-white shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              {storeName || 'Sua loja'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: primary, color: textOnPrimary }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Aberta agora
              </span>
              <span className="text-[10px] text-gray-600">Entrega · Retirada</span>
            </div>
          </div>
        </div>

        {/* Tabs de categoria (estilo MenuPage) */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-gray-100">
          <button
            type="button"
            className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            Destaques
          </button>
          <button
            type="button"
            className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap text-gray-600 bg-gray-100"
          >
            Pratos
          </button>
          <button
            type="button"
            className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap text-gray-600 bg-gray-100"
          >
            Bebidas
          </button>
        </div>

        {/* Cards de produto */}
        <div className="p-4 space-y-3">
          <ProductCardMock
            name="Hambúrguer Artesanal"
            description="Pão brioche, blend 180g, queijo cheddar"
            price="R$ 32,90"
            primary={primary}
            secondary={secondary}
            textOnPrimary={textOnPrimary}
          />
          <ProductCardMock
            name="Batata Frita Crocante"
            description="Porção generosa com molho da casa"
            price="R$ 18,00"
            primary={primary}
            secondary={secondary}
            textOnPrimary={textOnPrimary}
          />
        </div>

        {/* Bottom bar "Ver carrinho" */}
        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            className="w-full text-sm font-semibold py-3 rounded-lg shadow-sm"
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            Ver carrinho · 2 itens
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProductCardMockProps {
  name: string
  description: string
  price: string
  primary: string
  secondary: string
  textOnPrimary: '#000000' | '#FFFFFF'
}

function ProductCardMock({
  name,
  description,
  price,
  primary,
  secondary,
  textOnPrimary,
}: ProductCardMockProps) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      <div
        className="h-16 w-16 rounded-md shrink-0 flex items-center justify-center"
        style={{ backgroundColor: secondary }}
      >
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke={primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 truncate">{name}</h4>
        <p className="text-xs text-gray-500 line-clamp-2">{description}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: primary }}>
            {price}
          </span>
          <button
            type="button"
            className="text-[10px] font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: primary, color: textOnPrimary }}
          >
            + Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
