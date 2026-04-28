import { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

import { loadPlacesLibrary } from './places-loader'

// Lê address_components do Google em campos estruturados que a UI usa.
// Cada `type` do Google vira uma chave conhecida.
function extractComponents(place: google.maps.places.PlaceResult): {
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
} {
  const out = { cep: '', street: '', number: '', neighborhood: '', city: '', state: '' }
  for (const c of place.address_components ?? []) {
    if (c.types.includes('postal_code')) out.cep = c.long_name
    else if (c.types.includes('route')) out.street = c.long_name
    else if (c.types.includes('street_number')) out.number = c.long_name
    else if (c.types.includes('sublocality_level_1') || c.types.includes('sublocality'))
      out.neighborhood = c.long_name
    else if (c.types.includes('administrative_area_level_2') && !out.city)
      out.city = c.long_name
    else if (c.types.includes('locality')) out.city = c.long_name
    else if (c.types.includes('administrative_area_level_1')) out.state = c.short_name
  }
  return out
}

export interface AddressSelection {
  latitude: number
  longitude: number
  formattedAddress: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

interface Props {
  onSelect: (selection: AddressSelection) => void
  placeholder?: string
  disabled?: boolean
}

export function AddressAutocomplete({
  onSelect,
  placeholder = 'Comece a digitar o endereço…',
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const places = await loadPlacesLibrary()
        if (cancelled || !inputRef.current) return

        const autocomplete = new places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'br' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          types: ['address'],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const lat = place.geometry?.location?.lat()
          const lng = place.geometry?.location?.lng()
          if (lat == null || lng == null) {
            setError('Selecione uma sugestão da lista para continuar.')
            return
          }
          setError(null)
          const components = extractComponents(place)
          onSelect({
            latitude: lat,
            longitude: lng,
            formattedAddress: place.formatted_address ?? '',
            ...components,
          })
        })

        autocompleteRef.current = autocomplete
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Falha ao carregar Google Places'
        setError(msg)
        setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onSelect])

  return (
    <div className="space-y-1">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </span>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || loading || !!error}
          placeholder={loading ? 'Carregando Google Places…' : placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
