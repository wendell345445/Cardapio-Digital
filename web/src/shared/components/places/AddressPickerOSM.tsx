import { useState } from 'react'
import { Check, MapPin, X } from 'lucide-react'

import { AddressAutocompleteOSM } from './AddressAutocompleteOSM'
import { AddressConfirmMap } from './AddressConfirmMap'

import type { GeoAddress, GeoSuggestion } from '@/shared/lib/geo-client'

// Componente orquestrador — entrada única de endereço pro produto.
// Fluxo:
//   1. Cliente digita endereço → autocomplete Photon.
//   2. Seleciona uma sugestão → ABRE MODAL de confirmação automaticamente.
//   3. No modal: mapa com pin arrastável + endereço estruturado editável.
//   4. "Confirmar" → callback `onConfirm(AddressResult)` com tudo já validado.
//
// CEP NÃO é entrada. Vem opcionalmente do Nominatim como saída (postcode).

export interface AddressResult {
  latitude: number
  longitude: number
  /** Endereço formatado (display_name do Nominatim ou label do Photon). */
  displayName: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  /** CEP opcional — só vem se Nominatim retornou postcode. NÃO é input. */
  zipCode?: string
  /** Campos editáveis manualmente no modal. */
  complement?: string
  reference?: string
}

interface Props {
  /** Valor inicial (modo edição). Quando ausente, renderiza só o input. */
  initial?: Partial<AddressResult>
  /** Coordenadas da loja pra bias do autocomplete. */
  biasLat?: number
  biasLon?: number
  /** Public (checkout) ou admin (PDV, configurações). */
  scope?: 'public' | 'admin'
  /** Campos extras no modal de confirmação. */
  withComplement?: boolean
  withReference?: boolean
  /** Disparado quando o cliente confirma o endereço no modal. */
  onConfirm: (result: AddressResult) => void
  /** Texto do botão final ("Confirmar este endereço" por padrão). */
  confirmLabel?: string
  /** Placeholder do input de busca. */
  searchPlaceholder?: string
}

function toResult(s: GeoSuggestion | GeoAddress): AddressResult {
  if ('label' in s) {
    return {
      latitude: s.latitude,
      longitude: s.longitude,
      displayName: s.label,
      street: s.street ?? '',
      number: s.number ?? '',
      neighborhood: s.neighborhood ?? '',
      city: s.city ?? '',
      state: s.state ?? '',
      zipCode: s.postcode,
    }
  }
  return {
    latitude: s.latitude,
    longitude: s.longitude,
    displayName: s.displayName,
    street: s.street ?? '',
    number: s.number ?? '',
    neighborhood: s.neighborhood ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    zipCode: s.postcode,
  }
}

export function AddressPickerOSM({
  initial,
  biasLat,
  biasLon,
  scope = 'public',
  withComplement = false,
  withReference = false,
  onConfirm,
  confirmLabel = 'Confirmar este endereço',
  searchPlaceholder,
}: Props) {
  const [staging, setStaging] = useState<AddressResult | null>(
    initial && initial.latitude && initial.longitude
      ? {
          latitude: initial.latitude,
          longitude: initial.longitude,
          displayName: initial.displayName ?? '',
          street: initial.street ?? '',
          number: initial.number ?? '',
          neighborhood: initial.neighborhood ?? '',
          city: initial.city ?? '',
          state: initial.state ?? '',
          zipCode: initial.zipCode,
          complement: initial.complement,
          reference: initial.reference,
        }
      : null
  )
  const [modalOpen, setModalOpen] = useState(false)

  function handleSelectSuggestion(s: GeoSuggestion) {
    const result = toResult(s)
    setStaging(result)
    setModalOpen(true)
  }

  function handlePinDragged(addr: GeoAddress) {
    setStaging((prev) => {
      if (!prev) return toResult(addr)
      // Pin arrastado: substitui coordenadas e displayName. Mantém complement
      // e reference que o cliente já tinha digitado, mas atualiza os campos
      // estruturados com o que veio do reverse — assim "Rua X mudou pra Rua Y"
      // ao mover o pin.
      return {
        ...prev,
        latitude: addr.latitude,
        longitude: addr.longitude,
        displayName: addr.displayName || prev.displayName,
        street: addr.street ?? prev.street,
        number: addr.number ?? prev.number,
        neighborhood: addr.neighborhood ?? prev.neighborhood,
        city: addr.city ?? prev.city,
        state: addr.state ?? prev.state,
        zipCode: addr.postcode ?? prev.zipCode,
      }
    })
  }

  function updateField<K extends keyof AddressResult>(key: K, value: AddressResult[K]) {
    setStaging((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function handleConfirm() {
    if (!staging) return
    onConfirm(staging)
    setModalOpen(false)
  }

  function handleCancel() {
    setModalOpen(false)
    setStaging(null)
  }

  return (
    <>
      <div className="space-y-2">
        <AddressAutocompleteOSM
          onSelect={handleSelectSuggestion}
          biasLat={biasLat}
          biasLon={biasLon}
          scope={scope}
          placeholder={searchPlaceholder}
        />
        {staging && !modalOpen && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
            <MapPin size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900">
                {staging.street} {staging.number}
              </div>
              <div className="text-xs text-gray-600">
                {[staging.neighborhood, staging.city, staging.state].filter(Boolean).join(', ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Alterar
            </button>
          </div>
        )}
      </div>

      {modalOpen && staging && (
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <div className="flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Confirme o endereço</h2>
                <p className="text-xs text-gray-500">
                  Arraste o pino para ajustar a localização exata.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AddressConfirmMap
                latitude={staging.latitude}
                longitude={staging.longitude}
                onChange={handlePinDragged}
                scope={scope}
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Rua</label>
                  <input
                    type="text"
                    value={staging.street}
                    onChange={(e) => updateField('street', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Número</label>
                  <input
                    type="text"
                    value={staging.number}
                    onChange={(e) => updateField('number', e.target.value)}
                    placeholder="Ex: 1578"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Bairro</label>
                  <input
                    type="text"
                    value={staging.neighborhood}
                    onChange={(e) => updateField('neighborhood', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cidade</label>
                  <input
                    type="text"
                    value={staging.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {withComplement && (
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium text-gray-600">
                      Complemento (apartamento, bloco, sala…)
                    </label>
                    <input
                      type="text"
                      value={staging.complement ?? ''}
                      onChange={(e) => updateField('complement', e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                )}

                {withReference && (
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium text-gray-600">
                      Ponto de referência
                    </label>
                    <input
                      type="text"
                      value={staging.reference ?? ''}
                      onChange={(e) => updateField('reference', e.target.value)}
                      placeholder="Ex: portão azul, ao lado da padaria"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!staging.street || !staging.city}
                className="flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={16} />
                {confirmLabel}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
