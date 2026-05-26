import { useScrolled } from '../hooks/useScrolled'

interface Props {
  title: string
  onBack: () => void
}

const HEADER_HEIGHT = 60

export function PageHeader({ title, onBack }: Props) {
  const scrolled = useScrolled()

  return (
    <>
      <div
        className={`fixed left-1/2 top-0 z-30 flex w-full max-w-[768px] -translate-x-1/2 items-center justify-center bg-menu-bg px-4 transition-[border-color] duration-150 sm:px-6 md:px-8 ${
          scrolled ? 'border-b border-menu-divider' : 'border-b border-transparent'
        }`}
        style={{ height: HEADER_HEIGHT }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/85 text-menu-text shadow-[0_4px_14px_rgba(64,57,57,0.05)] backdrop-blur-sm transition-all duration-200 active:scale-95 sm:left-6 md:left-8"
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
          {title}
        </h1>
      </div>

      <div aria-hidden="true" style={{ height: HEADER_HEIGHT }} />
    </>
  )
}
