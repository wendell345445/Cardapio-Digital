interface Props {
  quantity: number
  total: number
  onClick: () => void
  /** Distância adicional do bottom (px) — usar quando há BottomNavigation por baixo. */
  bottomOffset?: number
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CartSummaryBar({ quantity, total, onClick, bottomOffset = 86 }: Props) {
  if (quantity <= 0) return null

  return (
    <aside
      className="fixed left-1/2 z-[49] w-full max-w-[768px] -translate-x-1/2 px-4 sm:px-6 md:px-8"
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
      aria-label="Resumo do carrinho"
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3 shadow-[0_8px_26px_rgba(64,57,57,0.13)] transition-transform active:scale-[0.99]"
        style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)' }}
      >
        <div className="min-w-0 text-left">
          <p className="text-[11px] font-semibold leading-[14px] tracking-[-0.12px] text-menu-text-soft">
            {quantity} {quantity === 1 ? 'item' : 'itens'} no carrinho
          </p>
          <strong className="mt-1 block text-[17px] font-extrabold leading-[20px] tracking-[-0.35px] text-menu-text">
            {fmt(total)}
          </strong>
        </div>

        <span
          className="flex h-[38px] shrink-0 items-center justify-center rounded-full bg-menu-primary px-5 text-[13px] font-bold leading-[17px] text-white shadow-menu-md"
        >
          Ver carrinho
        </span>
      </button>
    </aside>
  )
}
