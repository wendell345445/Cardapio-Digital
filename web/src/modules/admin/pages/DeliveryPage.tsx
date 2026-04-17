import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'

import {
  useCreateDistance,
  useCreateNeighborhood,
  useDeleteDistance,
  useDeleteNeighborhood,
  useDeliveryConfig,
  useSetDeliveryMode,
  useSetStoreCoordinates,
  useUpdateDistance,
  useUpdateNeighborhood,
} from '../hooks/useDelivery'
import { useStore } from '../hooks/useStore'
import type { DeliveryMode, DistanceRange, Neighborhood } from '../services/delivery.service'

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

// ─── Neighborhood form/modal ───────────────────────────────────────────────────

const neighborhoodSchema = z.object({
  name: z.string().min(1, 'Informe o nome do bairro'),
  fee: z.coerce.number().min(0, 'Taxa não pode ser negativa'),
})

type NeighborhoodForm = z.infer<typeof neighborhoodSchema>

function NeighborhoodModal({
  entry,
  onClose,
  onToast,
}: {
  entry: Neighborhood | null
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const createMutation = useCreateNeighborhood()
  const updateMutation = useUpdateNeighborhood()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NeighborhoodForm>({
    resolver: zodResolver(neighborhoodSchema),
    defaultValues: entry ? { name: entry.name, fee: entry.fee } : { fee: 0 },
  })

  const onSubmit = async (form: NeighborhoodForm) => {
    try {
      if (entry) {
        await updateMutation.mutateAsync({ id: entry.id, data: form })
        onToast('Bairro atualizado!', 'success')
      } else {
        await createMutation.mutateAsync(form)
        onToast('Bairro adicionado!', 'success')
      }
      onClose()
    } catch {
      onToast('Erro ao salvar bairro.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-900">
            {entry ? 'Editar Bairro' : 'Novo Bairro'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do bairro *</label>
            <input
              type="text"
              {...register('name')}
              placeholder="Ex: Centro"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
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

// ─── Mode selector ────────────────────────────────────────────────────────────

const MODES: { value: DeliveryMode; label: string; description: string }[] = [
  {
    value: 'NEIGHBORHOOD',
    label: 'Por Bairro',
    description: 'Define uma taxa fixa por bairro atendido',
  },
  {
    value: 'DISTANCE',
    label: 'Por Distância',
    description: 'Define faixas de km com taxas diferentes',
  },
]

// ─── DeliveryPage ─────────────────────────────────────────────────────────────

export function DeliveryPage() {
  const { data: config, isLoading, isError } = useDeliveryConfig()
  const { data: store } = useStore()
  const setModeMutation = useSetDeliveryMode()
  const setCoordsMutation = useSetStoreCoordinates()
  const deleteNeighborhoodMutation = useDeleteNeighborhood()
  const deleteDistanceMutation = useDeleteDistance()

  const navigate = useNavigate()
  const isPremium = store?.plan === 'PREMIUM'

  // null = closed, 'new' = create form, Neighborhood/DistanceRange = edit form
  const [neighborhoodModal, setNeighborhoodModal] = useState<Neighborhood | 'new' | null>(null)
  const [distanceModal, setDistanceModal] = useState<DistanceRange | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    { type: 'neighborhood'; entry: Neighborhood } | { type: 'distance'; entry: DistanceRange } | null
  >(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [coordLat, setCoordLat] = useState('')
  const [coordLng, setCoordLng] = useState('')

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleModeChange(mode: DeliveryMode) {
    try {
      await setModeMutation.mutateAsync(mode)
      showToast('Modo de entrega atualizado!', 'success')
    } catch {
      showToast('Erro ao alterar modo de entrega.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'neighborhood') {
        await deleteNeighborhoodMutation.mutateAsync(deleteTarget.entry.id)
        showToast('Bairro removido!', 'success')
      } else {
        await deleteDistanceMutation.mutateAsync(deleteTarget.entry.id)
        showToast('Faixa de distância removida!', 'success')
      }
    } catch {
      showToast('Erro ao excluir.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const isDeleting =
    deleteNeighborhoodMutation.isPending || deleteDistanceMutation.isPending

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
            {/* Plan info banner */}
            {!isPremium && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Plano Professional:</span> taxa fixa por bairro.
                    Upgrade para o plano <span className="font-semibold">Premium</span> para habilitar
                    faixas por distância (km).
                  </p>
                </div>
                <button
                  onClick={() => navigate('/admin/configuracoes?tab=assinatura')}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Fazer upgrade
                </button>
              </div>
            )}

            {/* Mode selector */}
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Modo de entrega</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODES.map((m) => {
                  const isSelected = config.mode === m.value
                  const isLocked = m.value === 'DISTANCE' && !isPremium
                  return (
                    <button
                      key={String(m.value)}
                      onClick={() => !isLocked && handleModeChange(m.value)}
                      disabled={setModeMutation.isPending || isLocked}
                      className={`rounded-xl border-2 p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isLocked
                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-blue-700' : 'text-gray-800'
                        }`}
                      >
                        {m.label}
                        {isLocked && (
                          <span className="ml-2 text-xs font-normal text-gray-400">Premium</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{m.description}</p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* NEIGHBORHOOD mode */}
            {config.mode === 'NEIGHBORHOOD' && (
              <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Bairros atendidos</h2>
                  <button
                    onClick={() => setNeighborhoodModal('new')}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={15} />
                    Adicionar bairro
                  </button>
                </div>

                {config.neighborhoods.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-400">
                    Nenhum bairro cadastrado ainda.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold text-gray-600">Bairro</th>
                        <th className="text-left px-5 py-3 font-semibold text-gray-600">Taxa</th>
                        <th className="text-left px-5 py-3 font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {config.neighborhoods.map((n) => (
                        <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-900">{n.name}</td>
                          <td className="px-5 py-3 text-gray-700">{formatCurrency(n.fee)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setNeighborhoodModal(n)}
                                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({ type: 'neighborhood', entry: n })
                                }
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
            )}

            {/* DISTANCE mode — coordinates */}
            {config.mode === 'DISTANCE' && (
              <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-blue-500" />
                  <h2 className="text-base font-semibold text-gray-900">
                    Localização da loja
                  </h2>
                </div>

                {config.latitude && config.longitude ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">
                      Lat: <span className="font-medium">{config.latitude}</span>, Lng:{' '}
                      <span className="font-medium">{config.longitude}</span>
                    </span>
                    <button
                      onClick={() => {
                        setCoordLat(String(config.latitude))
                        setCoordLng(String(config.longitude))
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      Alterar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        Configure a localização da loja para que o cálculo de taxa por
                        distância funcione. Informe as coordenadas (latitude e longitude).
                      </p>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={coordLat}
                          onChange={(e) => setCoordLat(e.target.value)}
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
                          onChange={(e) => setCoordLng(e.target.value)}
                          placeholder="-46.6333"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          const lat = Number(coordLat)
                          const lng = Number(coordLng)
                          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                            showToast('Coordenadas inválidas.', 'error')
                            return
                          }
                          try {
                            await setCoordsMutation.mutateAsync({ latitude: lat, longitude: lng })
                            setCoordLat('')
                            setCoordLng('')
                            showToast('Localização salva!', 'success')
                          } catch {
                            showToast('Erro ao salvar localização.', 'error')
                          }
                        }}
                        disabled={setCoordsMutation.isPending}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {setCoordsMutation.isPending ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* DISTANCE mode — ranges */}
            {config.mode === 'DISTANCE' && (
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
                                  onClick={() =>
                                    setDeleteTarget({ type: 'distance', entry: d })
                                  }
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
            )}

            {/* No mode selected */}
            {config.mode === null && (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center">
                <p className="text-sm text-gray-500">
                  Selecione um modo acima para configurar as taxas de entrega.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Neighborhood modal */}
      {neighborhoodModal !== null && (
        <NeighborhoodModal
          entry={neighborhoodModal === 'new' ? null : neighborhoodModal}
          onClose={() => setNeighborhoodModal(null)}
          onToast={showToast}
        />
      )}

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
          label={
            deleteTarget.type === 'neighborhood'
              ? deleteTarget.entry.name
              : `${deleteTarget.entry.minKm}–${deleteTarget.entry.maxKm} km`
          }
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
