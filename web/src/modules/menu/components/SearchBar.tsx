import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Pesquisar' }: Props) {
  return (
    <form
      className="mt-5 w-full"
      role="search"
      aria-label="Pesquisar produtos"
      onSubmit={(e) => e.preventDefault()}
    >
      <label htmlFor="menu-search" className="sr-only">
        Pesquisar
      </label>

      <div
        className="relative flex h-[42px] w-full items-center overflow-hidden rounded-full bg-white shadow-[0_2px_8px_rgba(64,57,57,0.06)] transition-all duration-200 focus-within:shadow-menu-sm"
        style={{ border: '0.3px solid rgba(191, 180, 180, 0.4)' }}
      >
        <Search
          className="pointer-events-none absolute left-[14px] h-[18px] w-[18px] text-menu-primary"
          strokeWidth={2.5}
        />

        <input
          id="menu-search"
          name="pesquisar"
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full bg-transparent pl-[42px] pr-4 text-sm font-normal leading-none tracking-[-0.33px] text-[#676767] outline-none placeholder:text-[#676767]"
          style={{ fontSize: 16 }}
        />
      </div>
    </form>
  )
}
