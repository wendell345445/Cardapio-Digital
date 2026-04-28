import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'

import {
  useCreateDistance,
  useDeleteDistance,
  useDeliveryConfig,
  useSetStoreCoordinates,
  useUpdateDistance,
} from '../hooks/useDelivery'
import type { DistanceRange } from '../services/delivery.service'

import { ManualCoordinatesModal } from '@/shared/components/ManualCoordinatesModal'
import { AddressAutocomplete, type AddressSelection } from '@/shared/components/places/AddressAutocomplete'
import { AddressConfirmModal } from '@/shared/components/places/AddressConfirmModal'

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Distance form/modal ───────────────────────────────────────────────────────

const distanceSchema = z.object({
  minKm: z.coerce.number().min(0, 'Mínimo não pode ser negativo'),
  maxKm: z.coerce.number().positive('Máximo deve ser positivo'),
  fee: z.coerce.number().min(0, 'Taxa não pode ser negativa'),
}).refine((d) => d.maxKm > d.minKm, {
  message: 'Km máximo deve ser maior que o mínimo',
  path: ['maxKm'],
})

type DistanceForm = z.infer<typeof distanceSchema>

function DistanceModal({
  entry,
  onClose,
  onToast,
}: {
  entry: DistanceRange | null
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const createMutation = useCreateDistance()
  const updateMutation = useUpdateDistance()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DistanceForm>({
    resolver: zodResolver(distanceSchema),
    defaultValues: entry ? { minKm: entry.minKm, maxKm: entry.maxKm, fee: entry.fee } : { minKm: 0, fee: 0 },
  })

  const onSubmit = async (form: DistanceForm) => {
    try {
      if (entry) {
        await updateMutation.mutateAsync({ id: entry.id, data: form })
        onToast('Faixa de distância atualizada!', 'success')
      } else {
        await createMutation.mutateAsync(form)
        onToast('Faixa de distância adicionada!', 'success')
      }
      onClose()
    } catch {
      onToast('Erro ao salvar faixa de distância.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-900">
            {entry ? 'Editar Faixa' : 'Nova Faixa de Distância'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Km mínimo *</label>
              <input
                type="number"
                step="0.1"
                {...register('minKm')}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.minKm && <p className="text-red-500 text-xs mt-1">{errors.minKm.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Km máximo *</label>
              <input
                type="number"
                step="0.1"
                {...register('maxKm')}
                placeholder="5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxKm && <p className="text-red-500 text-xs mt-1">{errors.maxKm.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de entrega (R$) *</label>
            <input
              type="number"
              step="0.01"
              {...register('fee')}
              placeholder="0,00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.fee && <p className="text-red-500 text-xs mt-1">{errors.fee.message}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DeleteConfirmDialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({
  label,
  onClose,
  onConfirm,
  isDeleting,
}: {
  label: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">Confirmar exclusão</h2>
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir <span className="font-semibold">{label}</span>? Esta
          ação não pode ser desfeita.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DeliveryPage ─────────────────────────────────────────────────────────────

export function DeliveryPage() {
  const { data: config, isLoading, isError } = useDeliveryConfig()
  const setCoordsMutation = useSetStoreCoordinates()
  const deleteDistanceMutation = useDeleteDistance()

  const [distanceModal, setDistanceModal] = useState<DistanceRange | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DistanceRange | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [coordLat, setCoordLat] = useState('')
  const [coordLng, setCoordLng] = useState('')
  const [coordLabel, setCoordLabel] = useState<string | null>(null)
  const [editingCoords, setEditingCoords] = useState(false)

  // Selecao do Places aguardando confirmacao no modal com mapa.
  const [pendingSelection, setPendingSelection] = useState<AddressSelection | null>(null)
  const [manualModalOpen, setManualModalOpen] = useState(false)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // useCallback porque AddressAutocomplete usa onSelect em useEffect — referencia
  // estavel evita reinicializar o widget Google a cada render.
  const handlePlaceSelected = useCallback((selection: AddressSelection) => {
    setPendingSelection(selection)
  }, [])

  async function handleConfirmSelection(selection: AddressSelection) {
    try {
      await setCoordsMutation.mutateAsync({
        latitude: selection.latitude,
        longitude: selection.longitude,
        addressLabel: selection.formattedAddress || null,
      })
      setPendingSelection(null)
      setEditingCoords(false)
      setCoordLat('')
      setCoordLng('')
      setCoordLabel(null)
      showToast('Localização salva!', 'success')
    } catch {
      showToast('Erro ao salvar localização.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDistanceMutation.mutateAsync(deleteTarget.id)
      showToast('Faixa de distância removida!', 'success')
    } catch {
      showToast('Erro ao excluir.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleSaveCoords() {
    const lat = Number(coordLat)
    const lng = Number(coordLng)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Coordenadas inválidas.', 'error')
      return
    }
    try {
      // Se temos um label (veio do geocode), manda pro backend reusar.
      // Se não temos (edição manual), omite: backend faz reverse automático.
      await setCoordsMutation.mutateAsync({
        latitude: lat,
        longitude: lng,
        ...(coordLabel ? { addressLabel: coordLabel } : {}),
      })
      setEditingCoords(false)
      setCoordLat('')
      setCoordLng('')
      setCoordLabel(null)
      showToast('Localização salva!', 'success')
    } catch {
      showToast('Erro ao salvar localização.', 'error')
    }
  }

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="space-y-6">
        {isLoading && (
          <p className="text-center text-sm text-gray-500 py-12">Carregando configurações...</p>
        )}

        {isError && (
          <p className="text-center text-sm text-red-600 py-12">
            Erro ao carregar configurações de entrega.
          </p>
        )}

        {!isLoading && !isError && config && (
          <>
            {/* Store coordinates */}
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">
                  Localização da loja
                </h2>
              </div>

              {config.latitude && config.longitude && !editingCoords ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {config.addressLabel ? (
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {config.addressLabel}
                      </p>
                    ) : (
                      <p className="text-sm italic text-gray-400">
                        Endereço não informado — coordenadas inseridas manualmente.
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Lat: <span className="font-medium text-gray-700">{config.latitude}</span>
                      <span className="mx-1">·</span>
                      Lng: <span className="font-medium text-gray-700">{config.longitude}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCoordLat(String(config.latitude))
                      setCoordLng(String(config.longitude))
                      setCoordLabel(config.addressLabel)
                      setEditingCoords(true)
                    }}
                    className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    Alterar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Busque o endereço da loja abaixo ou informe as coordenadas
                      (latitude e longitude) manualmente.
                    </p>
                  </div>

                  {/* Busca por endereco via Google Places. Selecionar uma sugestao
                      abre um modal com mapa pra confirmacao visual antes de salvar. */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Buscar endereço
                    </p>
                    <AddressAutocomplete onSelect={handlePlaceSelected} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        Digite e selecione uma sugestão. Você confirma no mapa antes de salvar.
                      </p>
                      <button
                        type="button"
                        onClick={() => setManualModalOpen(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                      >
                        Inserir manualmente
                      </button>
                    </div>
                  </div>

                  {coordLabel && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <p className="text-xs text-green-800">
                        📍 <span className="font-medium">{coordLabel}</span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className="w-40">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={coordLat}
                        onChange={(e) => {
                          setCoordLat(e.target.value)
                          // Edição manual invalida o endereço associado
                          setCoordLabel(null)
                        }}
                        placeholder="-23.5505"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-40">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={coordLng}
                        onChange={(e) => {
                          setCoordLng(e.target.value)
                          setCoordLabel(null)
                        }}
                        placeholder="-46.6333"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleSaveCoords}
                      disabled={setCoordsMutation.isPending}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {setCoordsMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                    {editingCoords && (
                      <button
                        onClick={() => {
                          setEditingCoords(false)
                          setCoordLat('')
                          setCoordLng('')
                          setCoordLabel(null)
                        }}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Distance ranges */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Faixas de distância</h2>
                <button
                  onClick={() => setDistanceModal('new')}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus size={15} />
                  Adicionar faixa
                </button>
              </div>

              {config.distances.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">
                  Nenhuma faixa de distância cadastrada ainda.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Faixa (km)</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Taxa</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {config.distances
                      .slice()
                      .sort((a, b) => a.minKm - b.minKm)
                      .map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-900">
                            {d.minKm} – {d.maxKm} km
                          </td>
                          <td className="px-5 py-3 text-gray-700">{formatCurrency(d.fee)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDistanceModal(d)}
                                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(d)}
                                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                                title="Remover"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>

      {/* Distance modal */}
      {distanceModal !== null && (
        <DistanceModal
          entry={distanceModal === 'new' ? null : distanceModal}
          onClose={() => setDistanceModal(null)}
          onToast={showToast}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmDialog
          label={`${deleteTarget.minKm}–${deleteTarget.maxKm} km`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isDeleting={deleteDistanceMutation.isPending}
        />
      )}

      <ManualCoordinatesModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Inserir coordenadas manualmente"
        description="Abra o Google Maps, encontre o endereço exato da loja e cole as coordenadas."
        onConfirm={(coords) => {
          setCoordLat(String(coords.latitude))
          setCoordLng(String(coords.longitude))
          setCoordLabel(null)
          setEditingCoords(true)
          setManualModalOpen(false)
          showToast('Coordenadas preenchidas. Clique em "Salvar" para confirmar.', 'success')
        }}
      />

      <AddressConfirmModal
        selection={pendingSelection}
        onClose={() => setPendingSelection(null)}
        onConfirm={handleConfirmSelection}
      />
    </div>
  )
}
