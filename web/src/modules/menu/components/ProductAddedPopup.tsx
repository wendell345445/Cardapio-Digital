// Popup que aparece após "Adicionar" no detalhe do produto. Cliente confirma
// quantidade + observações antes de seguir, com 2 ações: continuar comprando
// (volta pro cardápio) ou avançar pro carrinho (abre o checkout).

interface Props {
  productName: string
  quantity: number
  observation: string
  onObservationChange: (value: string) => void
  onDecreaseQuantity: () => void
  onIncreaseQuantity: () => void
  onContinueShopping: () => void
  onGoToCart: () => void
}

export function ProductAddedPopup({
  productName,
  quantity,
  observation,
  onObservationChange,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onContinueShopping,
  onGoToCart,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 [font-family:'Sen',Helvetica] antialiased"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-label="Produto adicionado ao carrinho"
    >
      <button
        type="button"
        aria-label="Fechar confirmação"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onContinueShopping}
      />

      <section
        className="relative z-[81] w-full max-w-[390px] overflow-hidden rounded-[22px] bg-white px-4 pb-4 pt-5 shadow-[0_16px_44px_rgba(0,0,0,0.24)] animate-[cartSheetUp_0.24s_ease-out]"
        style={{ border: '0.6px solid rgba(255, 255, 255, 0.55)' }}
      >
        <style>{`
          @keyframes cartSheetUp {
            from { opacity: 0.9; transform: translateY(32px) scale(0.985); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-[82px] w-[82px] items-center justify-center">
            {/* Sacola com checkmark — SVG idêntico ao MenuPanda */}
            <svg width="78" height="78" viewBox="0 0 512 512" aria-hidden="true">
              <defs>
                <linearGradient id="bagWhiteGradient">
                  <stop stopOpacity="1" stopColor="#ffffff" offset="0" />
                  <stop stopOpacity="1" stopColor="#ffffff" offset="1" />
                </linearGradient>
                <linearGradient
                  xlinkHref="#bagWhiteGradient"
                  id="bagHandleGradient"
                  x1="190.961"
                  x2="321.04"
                  y1="486.134"
                  y2="356.055"
                  gradientTransform="matrix(1 0 0 -1 0 512)"
                  gradientUnits="userSpaceOnUse"
                />
                <linearGradient id="bagRedGradient">
                  <stop stopOpacity="1" stopColor="#ff8787" offset="0" />
                  <stop stopOpacity="1" stopColor="#ff2929" offset="1" />
                </linearGradient>
                <linearGradient
                  xlinkHref="#bagRedGradient"
                  id="bagBodyGradient"
                  x1="68.356"
                  x2="443.647"
                  y1="337.598"
                  y2="-37.692"
                  gradientTransform="matrix(1 0 0 -1 0 512)"
                  gradientUnits="userSpaceOnUse"
                />
                <linearGradient
                  xlinkHref="#bagWhiteGradient"
                  id="bagCircleGradient"
                  x1="179.984"
                  x2="332.026"
                  y1="266.491"
                  y2="114.449"
                  gradientTransform="matrix(1 0 0 -1 0 512)"
                  gradientUnits="userSpaceOnUse"
                />
                <linearGradient
                  xlinkHref="#bagRedGradient"
                  id="bagCheckGradient"
                  x1="147.139"
                  x2="147.139"
                  y1="130.7"
                  y2="49.206"
                  gradientTransform="scale(1 -1) rotate(45 678.144 24.002)"
                  gradientUnits="userSpaceOnUse"
                />
              </defs>
              <path
                fill="url(#bagBodyGradient)"
                d="M256 0c-52.2 0-94.6 42.3-94.6 94.5v31.8h35.8V94.6c.4-32.4 27.1-58.4 59.5-58 31.8.4 57.6 26.1 58 58v31.8h35.8V94.6C350.6 42.3 308.2 0 256 0z"
              />
              <path
                fill="url(#bagBodyGradient)"
                d="M460.8 512H51.2c-27.3 0-49.4-22.1-49.4-49.5 0-5.2.8-10.4 2.4-15.4l97.4-298.5c6.6-20.3 25.6-34.1 47-34.1h214.8c21.4 0 40.4 13.8 47 34.1l97.5 298.5c8.5 26-5.7 53.9-31.6 62.4-5.1 1.7-10.2 2.5-15.5 2.5z"
              />
              <circle cx="256" cy="321.5" r="107.5" fill="url(#bagCircleGradient)" />
              <path
                fill="url(#bagCheckGradient)"
                d="m290.4 279.8-47.3 47.3-21.5-21.5c-6.7-6.7-17.5-6.7-24.1 0-6.7 6.7-6.7 17.5 0 24.1l33.5 33.5c6.7 6.7 17.4 6.7 24.1 0l59.4-59.4c6.7-6.6 6.7-17.4.1-24l-.1-.1c-6.6-6.6-17.4-6.6-24.1.1 0-.1 0 0 0 0z"
              />
              {/* handle reference (placeholder pra evitar tree-shake do gradient) */}
              <path d="M0 0" stroke="url(#bagHandleGradient)" />
            </svg>
          </div>

          <h2 className="mt-4 text-[15px] font-semibold leading-[19px] tracking-[-0.2px] text-black">
            {productName} adicionado ao carrinho !
          </h2>
        </div>

        <div className="mt-6 border-t border-[#403939]/12">
          <div className="flex h-[38px] items-center justify-between border-b border-[#403939]/12">
            <span className="text-[12px] font-normal tracking-[-0.15px] text-[#6d6262]">
              Quantidade
            </span>

            <div
              className="flex h-[24px] min-w-[76px] items-center justify-between rounded-full bg-menu-primary px-1.5 text-white shadow-menu-sm"
              role="group"
              aria-label="Controle de quantidade no carrinho"
            >
              <button
                type="button"
                onClick={quantity <= 1 ? undefined : onDecreaseQuantity}
                disabled={quantity <= 1}
                aria-label="Diminuir quantidade"
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full transition-all ${
                  quantity <= 1 ? 'cursor-not-allowed text-white/35' : 'text-white active:scale-90'
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12H19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
              <span className="min-w-[18px] text-center text-[11px] font-semibold leading-[1.2]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={onIncreaseQuantity}
                aria-label="Aumentar quantidade"
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full transition-transform active:scale-90"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <label className="block pt-3">
            <span className="block text-[12px] font-normal tracking-[-0.15px] text-[#6d6262]">
              Observações
            </span>
            <textarea
              value={observation}
              onChange={(e) => onObservationChange(e.target.value)}
              placeholder="Ex: Tirar ovo, tomate, etc."
              className="mt-2 min-h-[62px] w-full resize-none rounded-[8px] bg-white p-2.5 text-[11px] leading-[16px] text-menu-text outline-none placeholder:text-[#b7aeae]"
              style={{ border: '0.6px solid rgba(65, 57, 57, 0.16)', fontSize: 16 }}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinueShopping}
            className="flex h-[42px] w-full items-center justify-center rounded-full bg-white text-[13px] font-bold leading-[18px] text-menu-primary transition-transform active:scale-[0.99]"
            style={{ border: '1px solid color-mix(in srgb, var(--menu-primary) 72%, transparent)' }}
          >
            Continuar comprando
          </button>

          <button
            type="button"
            onClick={onGoToCart}
            className="flex h-[42px] w-full items-center justify-center rounded-full bg-menu-primary text-[13px] font-bold leading-[18px] text-white shadow-menu-md transition-transform active:scale-[0.99]"
          >
            Avançar para o carrinho
          </button>
        </div>
      </section>
    </div>
  )
}
