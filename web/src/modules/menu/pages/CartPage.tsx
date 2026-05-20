import { useNavigate } from 'react-router-dom'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { ThemeInjector } from '../components/ThemeInjector'

import { useStoreSlug } from '@/hooks/useStoreSlug'
import { resolveImageUrl } from '@/shared/lib/imageUrl'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CartPage() {
  const navigate = useNavigate()
  const slug = useStoreSlug()
  const { data: menu } = useMenu(slug)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const updateQty = useCartStore((s) => s.updateQty)

  // Apenas exibição. Taxa de entrega real só é calculada na tela de finalização
  // (depende do endereço); aqui mostramos como "—" placeholder.
  const subtotalValue = subtotal()

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const handleBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate('/')
  }

  // Quem entrou via QR de mesa não precisa se identificar (já foi no entry).
  const handleCheckout = () => navigate('/identifique-se')

  function lineUnitPrice(item: typeof items[number]): number {
    const base = item.variationPrice ?? item.unitPrice
    const adds = item.additionals.reduce((s, a) => s + a.price, 0)
    return base + adds
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <ThemeInjector
        primaryColor={menu?.store.primaryColor}
        secondaryColor={menu?.store.secondaryColor}
      />
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg px-4 sm:px-6 md:px-8"
        style={{
          paddingBottom:
            items.length > 0
              ? 'calc(200px + env(safe-area-inset-bottom))'
              : 'calc(40px + env(safe-area-inset-bottom))',
        }}
      >
        <header className="relative mt-5 flex h-9 w-full items-center justify-center">
          <button
            type="button"
            aria-label="Voltar"
            onClick={handleBack}
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/85 text-menu-text shadow-[0_4px_14px_rgba(64,57,57,0.05)] backdrop-blur-sm transition-all duration-200 active:scale-95"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
          >
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

          <h1 className="text-center text-[19px] font-semibold leading-none tracking-[-0.28px] text-menu-text">
            Carrinho
          </h1>
        </header>

        <main className="flex flex-1 flex-col pt-7">
          <section aria-label="Itens do carrinho">
            <h2 className="text-[22px] font-semibold leading-none tracking-[-0.45px] text-menu-text">
              Seu pedido
            </h2>
            <p className="mt-2 text-[12px] font-normal leading-none tracking-[-0.12px] text-menu-text-soft">
              {items.length === 0
                ? 'Seu carrinho está vazio.'
                : `${totalQty} ${totalQty === 1 ? 'item' : 'itens'} no carrinho`}
            </p>

            {items.length === 0 ? (
              <EmptyCart onBackToMenu={() => navigate('/')} />
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {items.map((item) => {
                  const unit = lineUnitPrice(item)
                  const lineTotal = unit * item.quantity
                  return (
                    <CartProductCard
                      key={item.id}
                      name={item.productName}
                      variationName={item.variationName}
                      additionals={item.additionals}
                      notes={item.notes}
                      imageUrl={item.imageUrl}
                      quantity={item.quantity}
                      lineTotal={lineTotal}
                      onIncrease={() => updateQty(item.id, item.quantity + 1)}
                      onDecrease={() => updateQty(item.id, item.quantity - 1)}
                    />
                  )
                })}

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mx-auto my-4 flex w-fit items-center justify-center gap-1.5 text-[13px] font-semibold leading-none tracking-[-0.12px] text-menu-primary transition-opacity active:opacity-70"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Adicionar mais</span>
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      {items.length > 0 && (
        <footer
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-[768px] -translate-x-1/2 bg-gradient-to-t from-menu-bg via-menu-bg to-transparent px-4 pt-8 sm:px-6 md:px-8"
          style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
        >
          <div
            className="mb-3 rounded-[24px] bg-white px-4 py-3 shadow-[0_8px_26px_rgba(64,57,57,0.075)]"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
            aria-label="Resumo do pedido"
          >
            <div className="space-y-2.5">
              <SummaryRow label="Subtotal" value={fmt(subtotalValue)} />
              <SummaryRow label="Entrega" value="Calculado depois" muted />
              <SummaryRow label="Total" value={fmt(subtotalValue)} highlight />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-menu-primary px-4 text-base font-bold text-white shadow-menu-lg transition-all duration-200 active:scale-[0.99]"
          >
            <span>Avançar</span>
            <span>{fmt(subtotalValue)}</span>
          </button>
        </footer>
      )}

    </div>
  )
}

interface CartProductCardProps {
  name: string
  variationName?: string
  additionals: { id: string; name: string; price: number }[]
  notes?: string
  imageUrl?: string
  quantity: number
  lineTotal: number
  onIncrease: () => void
  onDecrease: () => void
}

function CartProductCard({
  name,
  variationName,
  additionals,
  notes,
  imageUrl,
  quantity,
  lineTotal,
  onIncrease,
  onDecrease,
}: CartProductCardProps) {
  const willRemove = quantity <= 1

  return (
    <article
      className="flex min-h-[104px] items-center gap-3 rounded-[22px] bg-white p-3 shadow-[0_6px_20px_rgba(64,57,57,0.055)]"
      style={{ border: '0.6px solid rgba(65, 57, 57, 0.09)' }}
      aria-label={name}
    >
      <div className="h-[82px] w-[88px] shrink-0 overflow-hidden rounded-[16px] bg-[#f3eeee]">
        {imageUrl ? (
          <img
            className="h-full w-full object-cover"
            alt={name}
            src={resolveImageUrl(imageUrl)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">
            🍽️
          </div>
        )}
      </div>

      <div className="flex min-h-[82px] min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[14px] font-medium leading-none tracking-[-0.15px] text-[#6f6666]">
              {quantity}x
            </span>
            <h2 className="truncate text-[15px] font-semibold leading-none tracking-[-0.2px] text-menu-text">
              {name}
            </h2>
          </div>
          {variationName && (
            <p className="mt-1 truncate text-[11px] text-menu-text-soft">{variationName}</p>
          )}
          {additionals.length > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-menu-text-soft">
              + {additionals.map((a) => a.name).join(', ')}
            </p>
          )}
          {notes && (
            <p className="mt-0.5 truncate text-[11px] italic text-menu-text-soft">Obs: {notes}</p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="mb-[2px] text-[13px] font-medium leading-none tracking-[-0.15px] text-[#818181]">
            R${' '}
            <span className="text-[17px] font-semibold text-[#212121]">
              {lineTotal.toFixed(2).replace('.', ',')}
            </span>
          </p>

          <div
            className="flex h-[28px] w-[82px] shrink-0 items-center justify-between rounded-full bg-menu-primary px-1.5 shadow-menu-sm"
            role="group"
            aria-label={`Controles de quantidade para ${name}`}
          >
            <button
              type="button"
              onClick={onDecrease}
              aria-label={
                willRemove
                  ? `Remover ${name}`
                  : `Diminuir quantidade de ${name}`
              }
              className="flex h-[19px] w-[19px] items-center justify-center rounded-full text-white transition-transform active:scale-90"
            >
              {willRemove ? (
                /* Lixeira — quando qty=1, próximo click remove o item */
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 3H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path
                    d="M18 6L17.2 19.1C17.1 20.2 16.2 21 15.1 21H8.9C7.8 21 6.9 20.2 6.8 19.1L6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 11V17M14 11V17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>

            <span className="text-[13px] font-semibold leading-none text-white">{quantity}</span>

            <button
              type="button"
              onClick={onIncrease}
              aria-label={`Aumentar quantidade de ${name}`}
              className="flex h-[19px] w-[19px] items-center justify-center rounded-full text-white transition-transform active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5V19M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function SummaryRow({
  label,
  value,
  highlight,
  muted,
}: {
  label: string
  value: string
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        highlight ? 'border-t border-menu-divider pt-3' : ''
      }`}
    >
      <span
        className={`tracking-[-0.12px] ${
          highlight
            ? 'text-[14px] font-semibold text-menu-text'
            : 'text-[12px] font-medium text-menu-text-soft'
        }`}
      >
        {label}
      </span>
      <strong
        className={`tracking-[-0.18px] ${
          highlight
            ? 'text-[20px] font-bold text-menu-text'
            : muted
              ? 'text-[12px] font-medium text-menu-text-soft'
              : 'text-[13px] font-semibold text-[#6d6262]'
        }`}
      >
        {value}
      </strong>
    </div>
  )
}

function EmptyCart({ onBackToMenu }: { onBackToMenu: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-[24px] bg-white px-6 py-8 text-center shadow-[0_6px_22px_rgba(64,57,57,0.055)]">
      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#fff0f0] text-menu-primary">
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      </div>

      <h2 className="mt-4 text-[18px] font-semibold leading-none tracking-[-0.25px] text-menu-text">
        Seu carrinho está vazio
      </h2>
      <p className="mt-2 max-w-[250px] text-[12px] leading-[17px] text-menu-text-soft">
        Adicione produtos do cardápio para continuar seu pedido.
      </p>

      <button
        type="button"
        onClick={onBackToMenu}
        className="mt-5 flex h-[42px] items-center justify-center rounded-full bg-menu-primary px-5 text-[13px] font-bold text-white shadow-menu-lg active:scale-[0.99]"
      >
        Ver produtos
      </button>
    </div>
  )
}
