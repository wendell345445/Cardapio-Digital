interface Props {
  storeName: string
  onMenuClick?: () => void
  onShareClick?: () => void
}

export function StoreHeader({ storeName, onMenuClick, onShareClick }: Props) {
  return (
    <section
      className="relative h-[49px] w-full overflow-hidden bg-gradient-to-r from-menu-gradient-from to-menu-gradient-to shadow-[0_6px_20px_rgba(201,31,37,0.20)]"
      aria-label="Cabeçalho da loja"
    >
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={onMenuClick}
        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white transition-transform active:scale-95 sm:left-4"
      >
        {/* Menu hamburguer estilizado (linhas escalonadas) — SVG idêntico ao MenuPanda */}
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16 7H3a1 1 0 0 1 0-2h13a1 1 0 0 1 0 2zm6 5a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h18a1 1 0 0 0 1-1zm-9 6a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h9a1 1 0 0 0 1-1z"
            fill="currentColor"
          />
        </svg>
      </button>

      <h1 className="flex h-full items-center justify-center px-20 text-center text-xl font-bold leading-none tracking-[-0.33px] text-white">
        {storeName}
      </h1>

      <button
        type="button"
        aria-label="Compartilhar"
        onClick={onShareClick}
        className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white transition-transform active:scale-95 sm:right-5"
      >
        {/* Share clássico (3 nós conectados) — SVG idêntico ao MenuPanda */}
        <svg className="h-[20px] w-[20px]" viewBox="0 0 512 512" fill="none" aria-hidden="true">
          <path
            d="M406 332c-29.641 0-55.761 14.581-72.167 36.755L191.99 296.124c2.355-8.027 4.01-16.346 4.01-25.124 0-11.906-2.441-23.225-6.658-33.636l148.445-89.328C354.307 167.424 378.589 180 406 180c49.629 0 90-40.371 90-90S455.629 0 406 0s-90 40.371-90 90c0 11.437 2.355 22.286 6.262 32.358l-148.887 89.59C156.869 193.136 132.937 181 106 181c-49.629 0-90 40.371-90 90s40.371 90 90 90c30.13 0 56.691-15.009 73.035-37.806l141.376 72.395C317.807 403.995 316 412.75 316 422c0 49.629 40.371 90 90 90s90-40.371 90-90-40.371-90-90-90z"
            fill="currentColor"
          />
        </svg>
      </button>
    </section>
  )
}
