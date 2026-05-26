import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'

import { autocompleteAddress, GeoSuggestion } from '@/shared/lib/geo-client'

// Autocomplete de endereço usando Photon (via proxy mTLS na api).
// Substitui o AddressAutocomplete do Google Places. Sem CEP como entrada —
// cliente digita endereço livre estilo iFood.
//
// O componente apenas SELECIONA uma sugestão. A confirmação no mapa (pin
// arrastável + reverse) acontece num modal separado (AddressConfirmMap) —
// quem orquestra é o AddressPickerOSM.

interface Props {
  onSelect: (suggestion: GeoSuggestion) => void
  /** Bias geográfico (ex: coordenadas da loja) — melhora ordem dos resultados. */
  biasLat?: number
  biasLon?: number
  /** Escopo de auth: 'public' (checkout) ou 'admin' (PDV, configurações). */
  scope?: 'public' | 'admin'
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function AddressAutocompleteOSM({
  onSelect,
  biasLat,
  biasLon,
  scope = 'public',
  placeholder = 'Digite seu endereço…',
  disabled,
  autoFocus,
}: Props) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 250)
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Token de request: descarta resposta de query antiga que chegou tarde.
  const requestIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const id = ++requestIdRef.current
    const q = debouncedQuery.trim()
    if (q.length < 3) {
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    autocompleteAddress(q, { lat: biasLat, lon: biasLon, limit: 6, scope })
      .then((data) => {
        if (cancelled || id !== requestIdRef.current) return
        setSuggestions(data)
        setOpen(true)
      })
      .catch((err) => {
        if (cancelled || id !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao buscar endereço')
        setSuggestions([])
      })
      .finally(() => {
        if (cancelled || id !== requestIdRef.current) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, biasLat, biasLon, scope])

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  function handleSelect(s: GeoSuggestion) {
    setQuery(s.label)
    setOpen(false)
    setSuggestions([])
    onSelect(s)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </span>
        <input
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && suggestions.length > 0 && (
        <div className="absolute z-[5000] left-0 right-0 mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={`${s.latitude}-${s.longitude}-${i}`}
              type="button"
              onClick={() => handleSelect(s)}
              className="flex w-full items-start gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
            >
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{s.label.split(',')[0]}</div>
                <div className="truncate text-xs text-gray-500">
                  {[s.neighborhood, s.city, s.state].filter(Boolean).join(', ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
