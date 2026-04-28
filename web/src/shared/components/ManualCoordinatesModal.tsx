import { useState } from 'react'
import { ExternalLink, MapPin, X } from 'lucide-react'

// Modal aberto quando o Google Geocoding não acha o endereço — orienta o
// cliente a abrir o Google Maps, achar o ponto, copiar lat/lng e colar nos
// dois campos. Usado tanto no checkout público (cliente do restaurante) quanto
// no admin/entregas (dono cadastrando coord da loja).

interface ManualCoordinatesModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (coords: { latitude: number; longitude: number }) => void
  // Texto contextual no topo do modal — ex: "Não conseguimos localizar
  // 'Rua X, 83'" ou "Confirme a localização exata da loja".
  title?: string
  description?: string
}

function parseCoord(value: string, min: number, max: number): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const num = Number(normalized)
  if (!Number.isFinite(num)) return null
  if (num < min || num > max) return null
  return num
}

export function ManualCoordinatesModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Não conseguimos localizar este endereço',
  description = 'Abra o Google Maps, encontre o local exato e cole as coordenadas abaixo.',
}: ManualCoordinatesModalProps) {
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  if (!isOpen) return null

  function handleConfirm() {
    const lat = parseCoord(latText, -90, 90)
    const lng = parseCoord(lngText, -180, 180)
    if (lat === null) {
      setError('Latitude inválida. Use um número entre -90 e 90 (ex: -23.5505)')
      return
    }
    if (lng === null) {
      setError('Longitude inválida. Use um número entre -180 e 180 (ex: -46.6333)')
      return
    }
    onConfirm({ latitude: lat, longitude: lng })
    setLatText('')
    setLngText('')
    setError(null)
  }

  function handleClose() {
    setLatText('')
    setLngText('')
    setError(null)
    setShowHelp(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-3"
          >
            Abrir Google Maps
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="block text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            {showHelp ? '− Esconder instruções' : '+ Como pegar as coordenadas no Google Maps?'}
          </button>

          {showHelp && (
            <ol className="text-sm text-gray-700 space-y-1 mb-4 list-decimal list-inside bg-gray-50 p-3 rounded">
              <li>
                Abra <strong>maps.google.com</strong> (no celular ou computador).
              </li>
              <li>Procure o endereço o mais próximo possível.</li>
              <li>
                <strong>Toque e segure</strong> (celular) ou <strong>clique com o botão direito</strong> (computador) no
                ponto exato do local.
              </li>
              <li>
                Aparece um cardzinho com dois números separados por vírgula (ex:{' '}
                <code>-23.5505, -46.6333</code>). Toque/clique para copiar.
              </li>
              <li>Volte aqui e cole o primeiro número em Latitude e o segundo em Longitude.</li>
            </ol>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={latText}
                onChange={(e) => {
                  setLatText(e.target.value)
                  setError(null)
                }}
                placeholder="-23.5505"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={lngText}
                onChange={(e) => {
                  setLngText(e.target.value)
                  setError(null)
                }}
                placeholder="-46.6333"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-3" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-md"
            >
              Confirmar coordenadas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
