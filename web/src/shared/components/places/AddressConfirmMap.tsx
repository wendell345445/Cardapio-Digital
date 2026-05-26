import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { GeoAddress, reverseAddress } from '@/shared/lib/geo-client'

// Mapa Leaflet com pin arrastável. Tiles do OpenStreetMap público (grátis).
// Ao arrastar o pin, dispara reverse geocoding (Nominatim) e devolve o
// endereço atualizado.

// Fix do icon padrão do Leaflet em bundlers (Vite quebra os paths internos):
// usamos um SVG inline pra não depender dos assets do node_modules.
const PIN_ICON = L.divIcon({
  className: 'leaflet-custom-pin',
  html: `<div style="
    width:32px;height:42px;
    transform:translate(-16px,-42px);
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));
  ">
    <svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.16 24.84 0 16 0z" fill="#EF4444"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  </div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
})

interface Props {
  /** Coordenada inicial do pin. */
  latitude: number
  longitude: number
  /** Callback chamado quando o cliente arrasta o pin (recebe o endereço novo). */
  onChange: (address: GeoAddress) => void
  scope?: 'public' | 'admin'
  height?: number
}

export function AddressConfirmMap({
  latitude,
  longitude,
  onChange,
  scope = 'public',
  height = 280,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [reversing, setReversing] = useState(false)

  // Inicializa o mapa só uma vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 17,
      scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    const marker = L.marker([latitude, longitude], { draggable: true, icon: PIN_ICON }).addTo(map)
    marker.on('dragend', async () => {
      const ll = marker.getLatLng()
      setReversing(true)
      try {
        const addr = await reverseAddress(ll.lat, ll.lng, scope)
        onChange(addr)
      } catch {
        // Reverse falhou: ainda devolvemos a coordenada nova (texto fica como estava).
        onChange({
          displayName: '',
          latitude: ll.lat,
          longitude: ll.lng,
        })
      } finally {
        setReversing(false)
      }
    })

    mapRef.current = map
    markerRef.current = marker

    // Cleanup ao desmontar
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Inicializa SÓ na montagem (deps vazias); mudanças vêm pelo efeito abaixo.
  }, []) // eslint-disable-line

  // Atualiza posição do pin quando lat/lon mudam por fora (ex: usuário escolhe
  // outra sugestão no autocomplete sem fechar o modal).
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    markerRef.current.setLatLng([latitude, longitude])
    mapRef.current.setView([latitude, longitude], 17)
  }, [latitude, longitude])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ height }}
        className="overflow-hidden rounded-lg border border-gray-200"
      />
      {reversing && (
        <div className="absolute bottom-2 right-2 rounded-full bg-white px-3 py-1 text-xs text-gray-600 shadow">
          Atualizando endereço…
        </div>
      )}
      <p className="mt-2 text-center text-xs text-gray-500">
        📍 Arraste o pino para ajustar a localização exata
      </p>
    </div>
  )
}
