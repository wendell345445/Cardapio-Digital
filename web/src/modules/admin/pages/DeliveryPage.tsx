import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Info, Lightbulb, MapPin, Plus, Trash2, X } from 'lucide-react'

import {
  useCreateDistance,
  useCreateNeighborhood,
  useDeleteDistance,
  useDeleteNeighborhood,
  useDeliveryConfig,
  useSetStoreCoordinates,
  useUpdateDeliverySettings,
  useUpdateDistance,
  useUpdateNeighborhood,
} from '../hooks/useDelivery'
import type {
  CreateDistanceData,
  CreateNeighborhoodData,
  DistanceRange,
  Neighborhood,
} from '../services/delivery.service'

import { ManualCoordinatesModal } from '@/shared/components/ManualCoordinatesModal'
import { AddressPickerOSM, type AddressResult } from '@/shared/components/places/AddressPickerOSM'

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

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: Parameters<T>) => {
      if (ref.current) clearTimeout(ref.current)
      ref.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay]
  )
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      {label && (
        <span className={`text-xs font-medium ${checked ? 'text-green-600' : 'text-gray-500'}`}>
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

// ─── Distance row (edição inline) ─────────────────────────────────────────────

function DistanceRow({
  row,
  onChange,
  onDelete,
}: {
  row: DistanceRange
  onChange: (patch: Partial<CreateDistanceData>) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_140px_40px] items-center gap-4 px-1 py-2">
      <NumInput
        value={row.maxKm}
        suffix="km"
        step={0.5}
        onCommit={(v) => onChange({ maxKm: v })}
      />
      <NumInput
        value={row.fee}
        prefix="R$"
        step={0.5}
        onCommit={(v) => onChange({ fee: v })}
      />
      <NumInput
        value={row.etaMin}
        suffix="min"
        step={1}
        onCommit={(v) => onChange({ etaMin: Math.max(0, Math.round(v)) })}
      />
      <Toggle
        checked={row.isAvailable}
        onChange={(v) => onChange({ isAvailable: v })}
        label={row.isAvailable ? 'Disponível' : 'Indisponível'}
      />
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
        title="Remover"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function NeighborhoodRow({
  row,
  onChange,
  onDelete,
}: {
  row: Neighborhood
  onChange: (patch: Partial<CreateNeighborhoodData>) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_140px_40px] items-center gap-4 px-1 py-2">
      <TextInput value={row.name} onCommit={(v) => onChange({ name: v })} />
      <NumInput
        value={row.fee}
        prefix="R$"
        step={0.5}
        onCommit={(v) => onChange({ fee: v })}
      />
      <NumInput
        value={row.etaMin}
        suffix="min"
        step={1}
        onCommit={(v) => onChange({ etaMin: Math.max(0, Math.round(v)) })}
      />
      <Toggle
        checked={row.isAvailable}
        onChange={(v) => onChange({ isAvailable: v })}
        label={row.isAvailable ? 'Disponível' : 'Indisponível'}
      />
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
        title="Remover"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function NumInput({
  value,
  prefix,
  suffix,
  step = 1,
  onCommit,
}: {
  value: number
  prefix?: string
  suffix?: string
  step?: number
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    setText(String(value))
  }, [value])
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-sm text-gray-500 pointer-events-none">{prefix}</span>
      )}
      <input
        type="number"
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text)
          if (!Number.isNaN(n) && n !== value) onCommit(n)
          else setText(String(value))
        }}
        className={`w-full rounded-lg border border-gray-300 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
          prefix ? 'pl-9' : 'pl-3'
        } ${suffix ? 'pr-12' : 'pr-3'}`}
      />
      {suffix && (
        <span className="absolute right-3 text-sm text-gray-500 pointer-events-none">{suffix}</span>
      )}
    </div>
  )
}

function TextInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder?: string
  onCommit: (v: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => {
    setText(value)
  }, [value])
  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim()
        if (trimmed && trimmed !== value) onCommit(trimmed)
        else setText(value)
      }}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
    />
  )
}

// ─── Modalidade dropdown ──────────────────────────────────────────────────────

type Mode = 'DISTANCE' | 'NEIGHBORHOOD'

function ModeDropdown({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  const [open, setOpen] = useState(false)
  const label = mode === 'DISTANCE' ? 'Faixas de entrega - Km' : 'Taxa por bairros'
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
      >
        {label}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                onChange('DISTANCE')
                setOpen(false)
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                mode === 'DISTANCE' ? 'font-semibold text-red-600' : 'text-gray-700'
              }`}
            >
              Faixas de entrega - Km
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('NEIGHBORHOOD')
                setOpen(false)
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                mode === 'NEIGHBORHOOD' ? 'font-semibold text-red-600' : 'text-gray-700'
              }`}
            >
              Taxa por bairros
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Frete grátis pill ────────────────────────────────────────────────────────

function FreeShippingPill({
  cents,
  onChange,
}: {
  cents: number | null
  onChange: (cents: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cents != null ? (cents / 100).toFixed(2) : '')

  if (cents == null && !editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft('')
          setEditing(true)
        }}
        className="rounded-lg bg-red-50 text-red-600 font-medium px-4 py-2.5 text-sm hover:bg-red-100 transition-colors whitespace-nowrap"
      >
        Ativar frete grátis para compras acima de R$...
      </button>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <span className="text-sm text-red-700">Frete grátis acima de R$</span>
        <input
          type="number"
          step="0.5"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-24 rounded-md border border-red-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="button"
          onClick={() => {
            const n = Number(draft)
            if (!Number.isNaN(n) && n > 0) onChange(Math.round(n * 100))
            setEditing(false)
          }}
          className="text-xs font-semibold text-red-600 hover:text-red-700"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <span className="text-sm text-green-700 font-medium">
        Frete grátis acima de {formatCurrency((cents ?? 0) / 100)}
      </span>
      <button
        type="button"
        onClick={() => {
          setDraft(((cents ?? 0) / 100).toFixed(2))
          setEditing(true)
        }}
        className="text-xs font-medium text-green-700 hover:text-green-800 underline"
      >
        Alterar
      </button>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Desativar
      </button>
    </div>
  )
}

// ─── DeleteConfirmDialog ──────────────────────────────────────────────────────

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
          Tem certeza que deseja excluir <span className="font-semibold">{label}</span>? Esta ação
          não pode ser desfeita.
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
  const updateSettings = useUpdateDeliverySettings()

  const createDistanceMutation = useCreateDistance()
  const updateDistanceMutation = useUpdateDistance()
  const deleteDistanceMutation = useDeleteDistance()

  const createNeighborhoodMutation = useCreateNeighborhood()
  const updateNeighborhoodMutation = useUpdateNeighborhood()
  const deleteNeighborhoodMutation = useDeleteNeighborhood()

  const [mode, setMode] = useState<Mode>('DISTANCE')
  const [toast, setToast] = useState<ToastState>(null)

  // Coords editing
  const [editingCoords, setEditingCoords] = useState(false)
  const [coordLat, setCoordLat] = useState('')
  const [coordLng, setCoordLng] = useState('')
  const [coordLabel, setCoordLabel] = useState<string | null>(null)
  const [manualModalOpen, setManualModalOpen] = useState(false)

  // Delete targets
  const [deleteDistance, setDeleteDistanceTarget] = useState<DistanceRange | null>(null)
  const [deleteNeighborhoodTarget, setDeleteNeighborhoodTarget] = useState<Neighborhood | null>(
    null
  )

  // Settings drafts (prepTimeMin é debounced ao digitar)
  const [prepDraft, setPrepDraft] = useState<string>('')
  useEffect(() => {
    if (config) setPrepDraft(String(config.prepTimeMin))
  }, [config])

  const commitPrepTime = useDebouncedCallback((value: number) => {
    if (Number.isNaN(value) || value < 0) return
    updateSettings.mutate({ prepTimeMin: Math.round(value) })
  }, 500)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Endereço selecionado + confirmado no AddressPickerOSM (modal já incluído).
  async function handleAddressConfirmed(result: AddressResult) {
    const label = [
      result.street && result.number ? `${result.street}, ${result.number}` : result.street,
      result.neighborhood,
      result.city,
      result.state,
    ]
      .filter(Boolean)
      .join(', ')
    try {
      await setCoordsMutation.mutateAsync({
        latitude: result.latitude,
        longitude: result.longitude,
        addressLabel: label || result.displayName || null,
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

  async function handleSaveCoords() {
    const lat = Number(coordLat)
    const lng = Number(coordLng)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Coordenadas inválidas.', 'error')
      return
    }
    try {
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

  const distances = useMemo(
    () => (config?.distances ?? []).slice().sort((a, b) => a.maxKm - b.maxKm),
    [config]
  )
  const neighborhoods = useMemo(
    () => (config?.neighborhoods ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [config]
  )

  async function addDistance() {
    const next: CreateDistanceData = {
      maxKm: distances.length ? distances[distances.length - 1].maxKm + 1 : 1,
      fee: 0,
      etaMin: 0,
      isAvailable: true,
    }
    try {
      await createDistanceMutation.mutateAsync(next)
    } catch {
      showToast('Erro ao adicionar raio.', 'error')
    }
  }

  async function addNeighborhood() {
    const next: CreateNeighborhoodData = {
      name: `Bairro ${neighborhoods.length + 1}`,
      fee: 0,
      etaMin: 0,
      isAvailable: true,
    }
    try {
      await createNeighborhoodMutation.mutateAsync(next)
    } catch {
      showToast('Erro ao adicionar bairro.', 'error')
    }
  }

  async function patchDistance(id: string, patch: Partial<CreateDistanceData>) {
    try {
      await updateDistanceMutation.mutateAsync({ id, data: patch })
    } catch {
      showToast('Erro ao atualizar raio.', 'error')
    }
  }

  async function patchNeighborhood(id: string, patch: Partial<CreateNeighborhoodData>) {
    try {
      await updateNeighborhoodMutation.mutateAsync({ id, data: patch })
    } catch {
      const msg = 'Erro ao atualizar bairro.'
      showToast(msg, 'error')
    }
  }

  async function handleDeleteDistance() {
    if (!deleteDistance) return
    try {
      await deleteDistanceMutation.mutateAsync(deleteDistance.id)
      showToast('Raio removido.', 'success')
    } catch {
      showToast('Erro ao excluir.', 'error')
    } finally {
      setDeleteDistanceTarget(null)
    }
  }

  async function handleDeleteNeighborhood() {
    if (!deleteNeighborhoodTarget) return
    try {
      await deleteNeighborhoodMutation.mutateAsync(deleteNeighborhoodTarget.id)
      showToast('Bairro removido.', 'success')
    } catch {
      showToast('Erro ao excluir.', 'error')
    } finally {
      setDeleteNeighborhoodTarget(null)
    }
  }

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {isLoading && (
        <p className="text-center text-sm text-gray-500 py-12">Carregando configurações...</p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-600 py-12">
          Erro ao carregar configurações de entrega.
        </p>
      )}

      {!isLoading && !isError && config && (
        <div className="space-y-6">
          {/* Header com dropdown de modalidade */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Modalidade de frete:</h2>
            <ModeDropdown mode={mode} onChange={setMode} />
          </div>

          {/* Prep time + frete grátis */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Tempo de preparo dos pedidos</p>
                <p className="text-xs text-gray-500">Será somado ao tempo de transporte.</p>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={prepDraft}
                  onChange={(e) => {
                    setPrepDraft(e.target.value)
                    const n = Number(e.target.value)
                    if (!Number.isNaN(n)) commitPrepTime(n)
                  }}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-500 pointer-events-none">
                  min
                </span>
              </div>
            </div>

            <div className="ml-auto">
              <FreeShippingPill
                cents={config.freeDeliveryAboveCents}
                onChange={(c) =>
                  updateSettings.mutate(
                    { freeDeliveryAboveCents: c },
                    {
                      onSuccess: () =>
                        showToast(
                          c == null ? 'Frete grátis desativado.' : 'Frete grátis configurado.',
                          'success'
                        ),
                    }
                  )
                }
              />
            </div>
          </div>

          {/* Localização da loja (sempre visível) */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">Localização da loja</h2>
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
                    Busque o endereço da loja abaixo ou informe as coordenadas manualmente.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Buscar endereço
                  </p>
                  <AddressPickerOSM
                    scope="admin"
                    onConfirm={handleAddressConfirmed}
                    searchPlaceholder="Digite o endereço da loja…"
                    confirmLabel="Salvar localização"
                  />
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
                        setCoordLabel(null)
                      }}
                      placeholder="-23.5505"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveCoords}
                    disabled={setCoordsMutation.isPending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
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

          {/* View distância */}
          {mode === 'DISTANCE' && (
            <section className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <Lightbulb size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  <span className="font-semibold">Importante:</span> nosso sistema mede a distância
                  do trajeto real, não em linha reta do ponto A ao B.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Raio de quilometragem</h3>
                <button
                  type="button"
                  onClick={addDistance}
                  className="inline-flex items-center gap-1.5 text-red-600 font-medium text-sm hover:text-red-700"
                >
                  <Plus size={16} /> Novo raio
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                {distances.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">
                    Nenhum raio cadastrado ainda.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_1fr_140px_40px] gap-4 px-1 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div>Raio</div>
                      <div>Taxa</div>
                      <div>Prazo</div>
                      <div>Atendimento</div>
                      <div></div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {distances.map((d) => (
                        <DistanceRow
                          key={d.id}
                          row={d}
                          onChange={(patch) => patchDistance(d.id, patch)}
                          onDelete={() => setDeleteDistanceTarget(d)}
                        />
                      ))}
                    </div>
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={addDistance}
                        className="inline-flex items-center gap-1.5 text-red-600 font-medium text-sm hover:text-red-700"
                      >
                        <Plus size={16} /> Novo raio
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* View bairros */}
          {mode === 'NEIGHBORHOOD' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Bairros atendidos</h3>
                <button
                  type="button"
                  onClick={addNeighborhood}
                  className="inline-flex items-center gap-1.5 text-red-600 font-medium text-sm hover:text-red-700"
                >
                  <Plus size={16} /> Novo bairro
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                {neighborhoods.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-2 text-center">
                    <MapPin size={36} className="text-red-200" />
                    <p className="text-sm text-gray-500">Nenhum bairro cadastrado</p>
                    <button
                      type="button"
                      onClick={addNeighborhood}
                      className="inline-flex items-center gap-1.5 text-red-600 font-medium text-sm hover:text-red-700"
                    >
                      <Plus size={16} /> Novo bairro
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_1fr_140px_40px] gap-4 px-1 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div>Bairro</div>
                      <div>Taxa</div>
                      <div>Prazo</div>
                      <div>Atendimento</div>
                      <div></div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {neighborhoods.map((n) => (
                        <NeighborhoodRow
                          key={n.id}
                          row={n}
                          onChange={(patch) => patchNeighborhood(n.id, patch)}
                          onDelete={() => setDeleteNeighborhoodTarget(n)}
                        />
                      ))}
                    </div>
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={addNeighborhood}
                        className="inline-flex items-center gap-1.5 text-red-600 font-medium text-sm hover:text-red-700"
                      >
                        <Plus size={16} /> Novo bairro
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {deleteDistance && (
        <DeleteConfirmDialog
          label={`raio ${deleteDistance.maxKm} km`}
          onClose={() => setDeleteDistanceTarget(null)}
          onConfirm={handleDeleteDistance}
          isDeleting={deleteDistanceMutation.isPending}
        />
      )}
      {deleteNeighborhoodTarget && (
        <DeleteConfirmDialog
          label={`o bairro "${deleteNeighborhoodTarget.name}"`}
          onClose={() => setDeleteNeighborhoodTarget(null)}
          onConfirm={handleDeleteNeighborhood}
          isDeleting={deleteNeighborhoodMutation.isPending}
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

    </div>
  )
}
