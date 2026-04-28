import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'

import type { AddressSelection } from './AddressAutocomplete'
import { loadMapsLibrary, loadMarkerLibrary } from './places-loader'

interface Props {
  selection: AddressSelection | null
  onClose: () => void
  onConfirm: (selection: AddressSelection) => void
}

export function AddressConfirmModal({ selection, onClose, onConfirm }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!selection) return
    let cancelled = false

    async function init() {
      try {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          loadMapsLibrary(),
          loadMarkerLibrary(),
        ])
        if (cancelled || !mapDivRef.current || !selection) return

        const center = { lat: selection.latitude, lng: selection.longitude }
        const map = new Map(mapDivRef.current, {
          center,
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          mapId: 'DELIVERY_CONFIRM_MAP',
        })
        const marker = new AdvancedMarkerElement({
          map,
          position: center,
          title: selection.formattedAddress,
        })
        mapRef.current = map
        markerRef.current = marker
        setMapLoading(false)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Falha ao carregar mapa'
        setMapError(msg)
        setMapLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      markerRef.current = null
      mapRef.current = null
    }
  }, [selection])

  if (!selection) return null

  const { formattedAddress, cep, street, number, neighborhood, city, state, latitude, longitude } =
    selection

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">Confirme o endereço</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative h-64 bg-gray-100">
          <div ref={mapDivRef} className="absolute inset-0" />
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 px-4 text-center">
              <p className="text-sm text-red-700">{mapError}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-sm font-medium text-blue-900">{formattedAddress}</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Lat: <span className="font-medium">{latitude.toFixed(6)}</span>
              <span className="mx-1">·</span>
              Lng: <span className="font-medium">{longitude.toFixed(6)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Field label="CEP" value={cep} />
            <Field label="UF" value={state} />
            <Field label="Rua" value={street} />
            <Field label="Número" value={number} />
            <Field label="Bairro" value={neighborhood} />
            <Field label="Cidade" value={city} />
          </div>

          <p className="text-xs text-gray-500">
            Confira no mapa se o pino está exatamente sobre a loja. Se não estiver, feche e
            busque novamente com mais detalhes.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selection)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Confirmar e salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-16 flex-shrink-0">{label}:</span>
      <span className="text-gray-900 font-medium truncate">{value || '—'}</span>
    </div>
  )
}
