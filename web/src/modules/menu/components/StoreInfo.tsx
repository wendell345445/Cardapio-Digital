interface Props {
  name: string
  logo?: string
  address?: string
  isOpen: boolean
  nextOpenLabel?: string | null
  tableNumber?: number | null
}

// Logo do app "Menu Panda" — fixo pra todas as lojas (decisão de marca).
// Ignora store.logo e renderiza sempre o panda em círculo com fundo
// gradiente vermelho, igual ao protótipo MenuPanda.
const MENU_PANDA_LOGO = 'https://c.animaapp.com/monm3nfypCyc4K/img/imagem-perfil.png'

export function StoreInfo({ name, address, isOpen, nextOpenLabel, tableNumber }: Props) {
  return (
    <section
      className="relative flex w-full items-start gap-3.5 sm:gap-4"
      aria-label="Informações do estabelecimento"
    >
      <div className="relative shrink-0">
        <img
          className="h-[74px] w-[74px] rounded-full object-cover shadow-[0_8px_22px_rgba(64,57,57,0.14)] sm:h-[78px] sm:w-[78px]"
          alt={`Logo de ${name}`}
          src={MENU_PANDA_LOGO}
        />
      </div>

      <div className="min-w-0 flex-1 pt-[4px]">
        {address ? (
          <div className="flex items-start gap-[7px]">
            {/* Mapa-com-pin (FontAwesome map-marker-alt v4) — mesmo SVG do MenuPanda */}
            <svg
              className="mt-[3px] h-[12px] w-[12px] shrink-0 text-menu-text"
              viewBox="0 0 512 512"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M400 0c-61.76 0-112 50.24-112 112 0 57.472 89.856 159.264 100.096 170.688 3.04 3.36 7.36 5.312 11.904 5.312s8.864-1.952 11.904-5.312C422.144 271.264 512 169.472 512 112 512 50.24 461.76 0 400 0zm0 160c-26.496 0-48-21.504-48-48s21.504-48 48-48 48 21.504 48 48-21.504 48-48 48zM10.048 187.968A16.048 16.048 0 0 0 0 202.848V496c0 5.312 2.656 10.272 7.04 13.248C9.728 511.04 12.832 512 16 512c2.016 0 4.032-.384 5.952-1.152L160 455.616V128L10.048 187.968z"
                fill="currentColor"
              />
              <path
                d="M435.712 304.064C426.624 314.176 413.6 320 400 320c-13.6 0-26.624-5.824-35.712-15.936-3.264-3.616-7.456-8.384-12.288-14.048V512l149.952-59.968c6.08-2.4 10.048-8.32 10.048-14.848V201.952c-26.208 44.384-61.248 85.344-76.288 102.112zM266.08 157.632 192 128v327.616l128 51.2v-256.96c-20.448-27.552-41.792-60.736-53.92-92.224z"
                fill="currentColor"
              />
            </svg>
            <p className="min-w-0 max-w-[450px] whitespace-pre-line text-[11px] font-normal leading-[1.38] tracking-[-0.28px] text-menu-text sm:text-xs">
              {address}
            </p>
          </div>
        ) : (
          <h2 className="truncate text-[15px] font-bold leading-tight tracking-[-0.3px] text-menu-text">
            {name}
          </h2>
        )}

        <div className="mt-[11px] h-px w-full max-w-[420px] bg-gradient-to-r from-menu-divider via-[rgba(64,57,57,0.05)] to-transparent" />

        <div className="mt-[10px] flex flex-wrap items-center gap-x-3 gap-y-2">
          <div
            className="flex items-center gap-[6px]"
            aria-label={isOpen ? 'Restaurante aberto agora' : 'Restaurante fechado'}
          >
            <span
              className="relative flex h-[9px] w-[9px] shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              {isOpen && (
                <span className="absolute h-[9px] w-[9px] rounded-full bg-[#39a00a]/20 animate-ping" />
              )}
              <span
                className={`relative h-[6px] w-[6px] rounded-full ${
                  isOpen
                    ? 'bg-[#39a00a] shadow-[0_0_0_3px_rgba(57,160,10,0.12)]'
                    : 'bg-gray-400 shadow-[0_0_0_3px_rgba(160,160,160,0.12)]'
                }`}
              />
            </span>

            <span
              className={`whitespace-nowrap text-[11px] font-semibold leading-none tracking-[-0.18px] ${
                isOpen ? 'text-[#137a13]' : 'text-gray-500'
              }`}
            >
              {isOpen ? 'Aberto agora' : nextOpenLabel ? `Fechado · abrimos ${nextOpenLabel}` : 'Fechado'}
            </span>
          </div>

          {tableNumber != null && (
            <>
              <span className="h-[13px] w-px bg-menu-divider" aria-hidden="true" />
              <span className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                🍽️ Mesa {tableNumber}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
