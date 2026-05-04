interface CategoryOption {
  id: string | null
  name: string
}

interface Props {
  categories: CategoryOption[]
  activeId: string | null
  onSelect: (id: string | null) => void
}

export function CategoryChips({ categories, activeId, onSelect }: Props) {
  return (
    <section
      className="relative z-20 mt-4 mb-3 overflow-visible"
      aria-label="Categorias"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-[-0.33px] text-[#6d5f5f]">
          Categorias
        </h2>
        {activeId !== null && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="whitespace-nowrap text-xs font-medium tracking-[-0.33px] text-[#ff6060] active:scale-95"
          >
            Ver todas
          </button>
        )}
      </div>

      <div className="relative mt-[14px] -mx-4 overflow-hidden bg-menu-bg sm:-mx-6 md:-mx-8">
        <nav
          aria-label="Categorias de produtos"
          className="relative z-20 flex w-full touch-pan-x items-center gap-2 overflow-x-auto overflow-y-hidden px-6 pt-1 pb-4 overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:px-8 md:px-10 [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const isActive = activeId === category.id
            return (
              <button
                key={category.id ?? '__all__'}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect(category.id)}
                className={`relative z-20 flex h-[31px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] px-4 transition-all duration-200 ${
                  isActive
                    ? 'shadow-[0_5px_12px_rgba(201,31,37,0.20)]'
                    : 'border border-[#ece7e7] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.07)]'
                }`}
                style={
                  isActive
                    ? { background: 'linear-gradient(135deg,#f53b3b 0%,#c91f25 100%)' }
                    : undefined
                }
              >
                {isActive && (
                  <>
                    <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#fff_0%,transparent_70%)] opacity-[0.12]" />
                    <span className="absolute bottom-0 left-[20%] h-[1.5px] w-[60%] rounded-full bg-white/40" />
                  </>
                )}
                <span
                  className={`relative whitespace-nowrap text-[13px] leading-none ${
                    isActive
                      ? 'font-extrabold tracking-[0.5px] text-white'
                      : 'font-semibold tracking-[0.2px] text-[#5c5555]'
                  }`}
                >
                  {category.name}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
