import { useCallback, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { useTableMode } from '../hooks/useTableMode'
import { SuspendedStorePage } from '../components/SuspendedStorePage'
import {
  calculateDeliveryFee as fetchDeliveryFee,
  geocodeAddress as fetchGeocode,
  listAvailableNeighborhoods,
  type PublicNeighborhood,
  validateCouponPublic,
} from '../services/orders.service'
import { getCustomerName } from '../lib/customerName'
import { listAddresses, removeAddress, type SavedAddress } from '../lib/customerAddresses'
import { lookupCepPublic } from '../lib/cepLookup'

import { useStoreSlug } from '@/hooks/useStoreSlug'
import { ManualCoordinatesModal } from '@/shared/components/ManualCoordinatesModal'
import {
  AddressAutocomplete,
  type AddressSelection,
} from '@/shared/components/places/AddressAutocomplete'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DeliveryMethodId = 'retirar' | 'endereco'

// Estado consolidado que segue da /checkout pra /pagamento via location.state.
// A página /pagamento monta o DTO final e dispara o submit.
export interface CheckoutNavState {
  deliveryMethod: DeliveryMethodId
  clientName: string
  address?: {
    street: string
    number: string
    complement?: string
    // Opcionais no modo bairro (cidade não é coletada).
    neighborhood?: string
    city?: string
    state?: string
    zipCode?: string
    /** Coords resolvidas pelo Google Geocoding ou coladas pelo cliente. */
    manualCoordinates?: { latitude: number; longitude: number }
  }
  /** Modo bairro: id do bairro escolhido. Backend cobra a taxa fixa cadastrada. */
  deliveryNeighborhoodId?: string
  couponCode?: string
  notes?: string
}

type AddressLabel = 'casa' | 'trabalho' | 'amigos'

interface AddressSheetState {
  cep: string
  street: string
  number: string
  complement: string
  reference: string
  neighborhood: string
  city: string
  state: string
  noNumber: boolean
  label: AddressLabel
}

const EMPTY_ADDRESS: AddressSheetState = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  reference: '',
  neighborhood: '',
  city: '',
  state: '',
  noNumber: false,
  label: 'casa',
}

function addressFromSaved(saved: SavedAddress | null): AddressSheetState {
  if (!saved) return EMPTY_ADDRESS
  return {
    cep: saved.zipCode ?? '',
    street: saved.street ?? '',
    number: saved.number ?? '',
    complement: saved.complement ?? '',
    reference: '',
    neighborhood: saved.neighborhood ?? '',
    city: saved.city ?? '',
    state: saved.state ?? '',
    noNumber: false,
    label: 'casa',
  }
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

// Chave estável que identifica um endereço (igual matchKey do localStorage).
// Usada pra marcar qual saved está selecionado no SavedAddressSheet.
function makeAddressKey(addr: AddressSheetState): string {
  const cep = (addr.cep ?? '').replace(/\D/g, '')
  return `${cep}|${addr.street.trim().toLowerCase()}|${addr.number.trim().toLowerCase()}`
}

function makeSavedKey(saved: SavedAddress): string {
  const cep = (saved.zipCode ?? '').replace(/\D/g, '')
  return `${cep}|${saved.street.trim().toLowerCase()}|${saved.number.trim().toLowerCase()}`
}

function isAddressComplete(addr: AddressSheetState): boolean {
  return (
    !!addr.street.trim() &&
    (!!addr.number.trim() || addr.noNumber) &&
    !!addr.neighborhood.trim() &&
    !!addr.city.trim()
  )
}

export function CheckoutPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()
  const { data: menu } = useMenu(slug)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const { tableNumber, deviceName } = useTableMode()

  const tableClientName = tableNumber ? deviceName?.trim() || 'Convidado' : null
  const clientName = tableClientName ?? getCustomerName()

  // Modo mesa pula etapas de entrega: vai direto pra pagamento (PENDING).
  const inTableMode = !!tableNumber

  // Endereços salvos no localStorage (ordenados por uso recente). Se há
  // ao menos um, pré-selecionamos o último usado e mostramos UI compacta
  // de "entregar em [endereço]" — cliente não precisa digitar de novo.
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => listAddresses())
  const lastUsed = savedAddresses[0] ?? null

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodId | null>(() => {
    if (inTableMode) return 'retirar'
    // Se cliente já tem endereço salvo, assume que vai querer entrega — pode
    // trocar pra retirar pelo botão "Retirar no local" que aparece junto.
    return lastUsed ? 'endereco' : null
  })
  const [showAddressSheet, setShowAddressSheet] = useState(false)
  const [showSavedSheet, setShowSavedSheet] = useState(false)
  const [address, setAddress] = useState<AddressSheetState>(() =>
    addressFromSaved(lastUsed)
  )

  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponValidating, setCouponValidating] = useState(false)
  const [showObservations, setShowObservations] = useState(false)
  const [notes, setNotes] = useState('')
  const observationsId = useId()

  // Coords + taxa de entrega — calculados via Google Geocoding (backend) +
  // calculateDeliveryFee logo após o cliente salvar o endereço. Se Google
  // não achar o endereço, abrimos modal pra colar lat/lng manualmente.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(() =>
    lastUsed?.latitude != null && lastUsed?.longitude != null
      ? { latitude: lastUsed.latitude, longitude: lastUsed.longitude }
      : null
  )
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)

  // Modo "Por bairro": se a loja cadastrou bairros, o cliente escolhe um no
  // sheet de endereço (substitui o input livre) e a taxa vem fixa do backend.
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<PublicNeighborhood[]>([])
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null)

  const deliveryByDistanceOn = menu?.store?.deliveryByDistanceEnabled !== false
  const deliveryByNeighborhoodOn = menu?.store?.deliveryByNeighborhoodEnabled !== false

  useEffect(() => {
    if (!deliveryByNeighborhoodOn) {
      setAvailableNeighborhoods([])
      return
    }
    let cancelled = false
    listAvailableNeighborhoods()
      .then((list) => {
        if (!cancelled) setAvailableNeighborhoods(list)
      })
      .catch(() => {
        // Loja sem bairros cadastrados → mantém fluxo de endereço/distância.
      })
    return () => {
      cancelled = true
    }
  }, [deliveryByNeighborhoodOn])

  // Cart vazio → cardápio (proteção contra entrar direto na URL).
  useEffect(() => {
    if (items.length === 0) navigate('/', { replace: true })
  }, [items.length, navigate])

  // Resolve lat/lng + taxa pra um endereço. Se Google falhar, abre modal manual.
  const lookupDeliveryFee = useCallback(
    async (
      payload: {
        street: string
        number: string
        neighborhood?: string
        city?: string
      },
      manual?: { latitude: number; longitude: number } | null
    ) => {
      setFeeLoading(true)
      setFeeError('')
      try {
        // Se já temos coords confiáveis (CEP via Google, Places, ou cliente
        // colou manualmente), pula direto pro cálculo da taxa. Senão tenta
        // geocodificar — pode falhar e abrir o modal manual.
        let resolved = manual
        if (!resolved) {
          try {
            resolved = await fetchGeocode(payload)
            setCoords({ latitude: resolved.latitude, longitude: resolved.longitude })
          } catch (geocodeErr: unknown) {
            const axiosErr = geocodeErr as { response?: { data?: { error?: string } } }
            const raw = axiosErr?.response?.data?.error ?? ''
            const isGeocodeMiss = /endere[çc]o n[ãa]o encontrado/i.test(raw)
            setFeeError(
              isGeocodeMiss
                ? 'Não foi possível localizar este endereço automaticamente. A loja confirmará a taxa.'
                : raw || 'Não foi possível calcular a taxa de entrega.'
            )
            setDeliveryFee(0)
            setDeliveryDistance(null)
            if (isGeocodeMiss) setManualOpen(true)
            return
          }
        }

        // Já temos coords — calcula a taxa contra a loja.
        try {
          const result = await fetchDeliveryFee({
            latitude: resolved.latitude,
            longitude: resolved.longitude,
          })
          setDeliveryFee(result.fee)
          setDeliveryDistance(result.distance ?? null)
        } catch (feeErr: unknown) {
          const axiosErr = feeErr as {
            response?: {
              data?: {
                error?: string
                details?: { maxKm?: number; distance?: number }
              }
            }
          }
          const raw = axiosErr?.response?.data?.error ?? ''
          const details = axiosErr?.response?.data?.details
          // Aqui não mexemos em `coords` — elas continuam válidas.
          let friendly: string
          if (/fora da área de entrega/i.test(raw)) {
            // Mensagem amigável com a área coberta. maxKm vem do backend.
            const maxKm = details?.maxKm
            const distance = details?.distance
            friendly = maxKm
              ? `Não atendemos seu endereço. Cobrimos até ${maxKm.toString().replace('.', ',')} km da loja${distance ? ` (você está a ${distance.toString().replace('.', ',')} km).` : '.'}`
              : 'Não atendemos seu endereço — está fora da área de entrega.'
          } else if (/nenhuma faixa/i.test(raw)) {
            // Loja ainda não cadastrou nenhuma faixa — esconde o erro do
            // cliente (problema de configuração da loja, não do endereço).
            // Backend é leniente no submit (fee=0) então deixa o pedido seguir.
            friendly = ''
          } else {
            friendly = raw || 'Erro ao calcular taxa de entrega.'
          }
          setFeeError(friendly)
          setDeliveryFee(0)
          setDeliveryDistance(null)
        }
      } finally {
        setFeeLoading(false)
      }
    },
    []
  )

  // Quando endereço fica completo no modo "endereco" → busca coords + taxa.
  // Se já temos coords (vieram do Google Places ou modal manual), passa
  // direto pra `lookupDeliveryFee` que pula o geocoding e calcula taxa.
  // Modo bairro: se selectedNeighborhoodId estiver setado, calcula taxa
  // direto via id (taxa fixa do bairro) e ignora geocode.
  useEffect(() => {
    if (deliveryMethod !== 'endereco') {
      setCoords(null)
      setDeliveryFee(0)
      setDeliveryDistance(null)
      setFeeError('')
      return
    }

    if (selectedNeighborhoodId) {
      let cancelled = false
      setFeeLoading(true)
      setFeeError('')
      fetchDeliveryFee({ neighborhoodId: selectedNeighborhoodId })
        .then((r) => {
          if (cancelled) return
          setDeliveryFee(r.fee)
          setDeliveryDistance(null)
        })
        .catch(() => {
          if (cancelled) return
          setFeeError('Não foi possível calcular a taxa do bairro.')
          setDeliveryFee(0)
        })
        .finally(() => {
          if (!cancelled) setFeeLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (!isAddressComplete(address)) return

    lookupDeliveryFee(
      {
        street: address.street.trim(),
        number: address.noNumber ? 'S/N' : address.number.trim(),
        neighborhood: address.neighborhood.trim() || undefined,
        city: address.city.trim() || undefined,
      },
      coords
    )
  }, [
    deliveryMethod,
    selectedNeighborhoodId,
    address.street,
    address.number,
    address.noNumber,
    address.neighborhood,
    address.city,
    coords,
    lookupDeliveryFee,
  ])

  // Validação do cupom em tempo real (debounce 500ms).
  const subtotalValue = subtotal()
  const discount = appliedCoupon?.discount ?? 0
  const total = Math.max(0, subtotalValue + deliveryFee - discount)

  useEffect(() => {
    const raw = couponCode.trim()
    if (!raw) {
      setAppliedCoupon(null)
      setCouponError('')
      setCouponValidating(false)
      return
    }
    if (subtotalValue <= 0) return

    const code = raw.toUpperCase()
    setCouponValidating(true)
    const timer = setTimeout(async () => {
      try {
        const result = await validateCouponPublic(code, subtotalValue)
        setAppliedCoupon({ code, discount: result.discount })
        setCouponError('')
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } }
        setAppliedCoupon(null)
        setCouponError(axiosErr?.response?.data?.error ?? 'Cupom inválido')
      } finally {
        setCouponValidating(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [couponCode, subtotalValue])

  if (menu?.store.storeStatus === 'suspended') {
    return <SuspendedStorePage storeName={menu.store.name} />
  }

  if (items.length === 0) return null

  const store = menu?.store
  // Granularidade: a loja pode ter Entrega global ligada mas todas as sub-modalidades
  // desligadas — nesse caso, esconde delivery do checkout. Se distância está off e
  // não há bairros cadastrados, também não há como atender.
  const hasAnyDeliveryMode =
    (deliveryByDistanceOn) ||
    (deliveryByNeighborhoodOn && availableNeighborhoods.length > 0)
  const allowDelivery = store?.allowDelivery !== false && hasAnyDeliveryMode
  const allowPickup = !!store?.allowPickup

  // "Fora da área de entrega" bloqueia o avanço — não faz sentido o cliente
  // tentar pagar um pedido que a loja não vai aceitar entregar.
  const isOutOfArea = /não atendemos|fora da área/i.test(feeError)

  const canAdvance = (() => {
    if (inTableMode) return true
    if (!deliveryMethod) return false
    if (deliveryMethod === 'endereco') {
      // Modo bairro não exige cidade (escondida no sheet): basta rua+número+bairro.
      const ok = selectedNeighborhoodId
        ? !!address.street.trim() && (!!address.number.trim() || address.noNumber)
        : isAddressComplete(address)
      if (!ok) return false
      if (feeLoading) return false
      if (isOutOfArea) return false
      // Outros erros de cálculo (loja sem faixas configuradas, etc) — a loja
      // confirma a taxa manualmente, deixa avançar.
      return true
    }
    return true // retirar: ok
  })()

  const handleBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate('/identifique-se')
  }

  const handleAdvance = () => {
    if (!canAdvance) return

    const navState: CheckoutNavState = {
      deliveryMethod: inTableMode ? 'retirar' : deliveryMethod!,
      clientName,
      couponCode: appliedCoupon?.code,
      notes: notes.trim() || undefined,
      deliveryNeighborhoodId:
        deliveryMethod === 'endereco' && !inTableMode && selectedNeighborhoodId
          ? selectedNeighborhoodId
          : undefined,
      address:
        deliveryMethod === 'endereco' && !inTableMode
          ? {
              zipCode: address.cep.replace(/\D/g, '') || undefined,
              street: address.street.trim(),
              number: address.noNumber ? 'S/N' : address.number.trim(),
              complement:
                [address.complement.trim(), address.reference.trim()]
                  .filter(Boolean)
                  .join(' | ') || undefined,
              neighborhood: address.neighborhood.trim() || undefined,
              city: address.city.trim() || undefined,
              state: address.state.trim() || undefined,
              manualCoordinates: coords ?? undefined,
            }
          : undefined,
    }
    navigate('/pagamento', { state: navState })
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg px-4 sm:px-6 md:px-8"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >
        <header className="relative mt-5 flex h-9 w-full items-center justify-center">
          <button
            type="button"
            aria-label="Voltar"
            onClick={handleBack}
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-[14px] bg-white/85 text-menu-text shadow-[0_4px_14px_rgba(64,57,57,0.05)] backdrop-blur-sm transition-all duration-200 active:scale-95"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14.25 6.25L8.5 12L14.25 17.75"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <h1 className="text-center text-[19px] font-semibold leading-none tracking-[-0.28px] text-menu-text">
            Finalizar Pedido
          </h1>
        </header>

        <main className="flex flex-1 flex-col pt-7">
          {/* Card "Este pedido será entregue a:" */}
          {!inTableMode && (
            <section
              aria-labelledby="delivery-person-heading"
              className="rounded-[22px] bg-white px-4 py-4 shadow-[0_6px_22px_rgba(64,57,57,0.055)]"
              style={{ border: '0.6px solid rgba(65, 57, 57, 0.08)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    id="delivery-person-heading"
                    className="text-[12px] font-normal leading-none tracking-[-0.15px] text-menu-text-soft"
                  >
                    Este pedido será entregue a:
                  </p>
                  <strong className="mt-2 block truncate text-[20px] font-semibold leading-none tracking-[-0.35px] text-menu-text">
                    {clientName || 'Não informado'}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/identifique-se')}
                  aria-label="Trocar destinatário"
                  className="flex h-[32px] shrink-0 self-center items-center justify-center gap-1.5 rounded-[7px] bg-white px-3.5 text-[12px] font-semibold leading-none tracking-[-0.15px] text-menu-primary transition-transform active:scale-95"
                  style={{ border: '0.8px solid rgba(239, 42, 48, 0.65)' }}
                >
                  <span>Trocar</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 11A8 8 0 0 0 5.9 6.2L4 8"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 4V8H8"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 13A8 8 0 0 0 18.1 17.8L20 16"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 20V16H16"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </section>
          )}

          {/* Mesa: aviso */}
          {inTableMode && (
            <section
              className="rounded-[22px] bg-blue-50 px-4 py-4"
              style={{ border: '0.6px solid rgba(59, 130, 246, 0.20)' }}
            >
              <p className="text-[14px] font-semibold text-blue-700">
                🍽️ Pedido para Mesa {tableNumber}
              </p>
              <p className="mt-1 text-[12px] text-blue-600">
                Pagamento será realizado ao fechar a comanda.
              </p>
            </section>
          )}

          {/* Escolha de entrega */}
          {!inTableMode && (
            <section className="mt-6" aria-labelledby="delivery-method-heading">
              {!deliveryMethod ? (
                <>
                  <h2
                    id="delivery-method-heading"
                    className="text-[15px] font-semibold leading-none tracking-[-0.25px] text-menu-text"
                  >
                    Escolha como vai receber seu pedido
                  </h2>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {allowPickup && (
                      <DeliveryMethodCard
                        label="Retirar"
                        description="Buscar no restaurante"
                        onClick={() => setDeliveryMethod('retirar')}
                      >
                        {/* Loja/casa */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M3 9.5L12 3L21 9.5V20A1.5 1.5 0 0 1 19.5 21.5H4.5A1.5 1.5 0 0 1 3 20V9.5Z"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <path d="M9 21V13H15V21" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      </DeliveryMethodCard>
                    )}
                    {allowDelivery && (
                      <DeliveryMethodCard
                        label="Cadastrar endereço"
                        description="Receber em casa"
                        onClick={() => setShowAddressSheet(true)}
                      >
                        {/* Pin de mapa */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M12 21S5 14.5 5 9.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21Z"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="9.5" r="2.5" stroke="white" strokeWidth="1.8" />
                        </svg>
                      </DeliveryMethodCard>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <SelectedDeliveryCard
                    method={deliveryMethod}
                    address={address}
                    onChange={() => {
                      if (deliveryMethod === 'endereco') {
                        // Se cliente tem múltiplos endereços salvos, abre sheet
                        // de seleção. Senão (ou só com 1 endereço), abre o form
                        // diretamente pra editar.
                        if (savedAddresses.length > 0) {
                          setShowSavedSheet(true)
                        } else {
                          setShowAddressSheet(true)
                        }
                        return
                      }
                      setDeliveryMethod(null)
                    }}
                    storeAddress={store?.address}
                  />
                  {/* Permite trocar entre Retirar e Endereço sem voltar zero */}
                  {deliveryMethod === 'endereco' && allowPickup && (
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('retirar')}
                      className="w-full rounded-[14px] border border-menu-card-border bg-white px-4 py-2.5 text-[12px] font-semibold text-menu-text-soft transition-colors hover:bg-gray-50"
                    >
                      Prefere retirar no local?
                    </button>
                  )}
                  {deliveryMethod === 'retirar' && allowDelivery && (
                    <button
                      type="button"
                      onClick={() => {
                        if (savedAddresses.length > 0) {
                          setShowSavedSheet(true)
                        } else {
                          setShowAddressSheet(true)
                        }
                      }}
                      className="w-full rounded-[14px] border border-menu-card-border bg-white px-4 py-2.5 text-[12px] font-semibold text-menu-text-soft transition-colors hover:bg-gray-50"
                    >
                      Prefere receber em casa?
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Aplicar cupom — só pra entrega cadastrada (igual MenuPanda) */}
          {(inTableMode || deliveryMethod === 'endereco' || deliveryMethod === 'retirar') && (
            <section className="mt-6" aria-label="Aplicar cupom">
              <div
                className="rounded-[20px] bg-white px-4 py-4 shadow-[0_5px_18px_rgba(64,57,57,0.05)]"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.11)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[14px] font-semibold leading-none tracking-[-0.2px] text-menu-text">
                      Aplicar cupom
                    </h2>
                    <p className="mt-2 text-[11px] font-normal leading-none tracking-[-0.1px] text-menu-text-soft">
                      Insira um cupom de desconto, se tiver.
                    </p>
                  </div>
                  {appliedCoupon && (
                    <span className="rounded-full bg-[#f2fff2] px-2.5 py-1 text-[10px] font-semibold text-[#137a13]">
                      Aplicado
                    </span>
                  )}
                </div>

                <div className="mt-3 flex h-[44px] items-center gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Digite seu cupom"
                    className="h-full min-w-0 flex-1 rounded-[15px] bg-[#faf8f8] px-3 text-[13px] font-semibold uppercase tracking-[0.3px] text-menu-text outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-[-0.1px] placeholder:text-[#aaa0a0]"
                    style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)', fontSize: 16 }}
                  />
                </div>
                {couponValidating && (
                  <p className="mt-2 text-[11px] text-menu-text-soft">Validando cupom…</p>
                )}
                {!couponValidating && couponError && (
                  <p className="mt-2 text-[11px] text-menu-primary">{couponError}</p>
                )}
                {!couponValidating && appliedCoupon && (
                  <p className="mt-2 text-[11px] text-green-600">
                    Desconto de {fmt(appliedCoupon.discount)} aplicado.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Observações (expansível) */}
          <section className="mt-6" aria-labelledby="observations-heading">
            <button
              type="button"
              aria-expanded={showObservations}
              aria-controls={observationsId}
              onClick={() => setShowObservations((c) => !c)}
              className="flex w-full items-center justify-between border-b border-menu-divider pb-3 text-left"
            >
              <span
                id="observations-heading"
                className="text-base font-bold tracking-[0] text-[#4f4c4c]"
              >
                Observações
              </span>
              <svg
                className={`h-[15px] w-[15px] text-menu-text-muted transition-transform ${
                  showObservations ? 'rotate-180' : ''
                }`}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showObservations && (
              <textarea
                id={observationsId}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-3 min-h-[86px] w-full resize-none rounded-[16px] bg-white p-3 text-[13px] leading-[18px] text-menu-text outline-none shadow-[0_3px_14px_rgba(64,57,57,0.04)] placeholder:text-[#9b9292]"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)', fontSize: 16 }}
                placeholder="Ex: sem cebola, tocar campainha, retirar talher..."
              />
            )}
          </section>

          {/* Resumo */}
          <section className="mt-4 flex flex-col" aria-label="Resumo do pedido">
            <SummaryRow label="Subtotal" value={fmt(subtotalValue)} />
            <SummaryRow
              label="Entrega"
              value={
                deliveryMethod !== 'endereco'
                  ? deliveryMethod === 'retirar'
                    ? 'Grátis'
                    : 'A calcular'
                  : feeLoading
                    ? 'Calculando…'
                    : feeError
                      ? 'A confirmar'
                      : deliveryFee > 0
                        ? fmt(deliveryFee)
                        : 'Grátis'
              }
            />
            {appliedCoupon && discount > 0 && (
              <SummaryRow
                label={`Desconto (${appliedCoupon.code})`}
                value={`-${fmt(discount)}`}
                positive
              />
            )}
            <SummaryRow label="Total" value={fmt(total)} highlight />
          </section>

          {/* Avisos do cálculo de taxa */}
          {deliveryMethod === 'endereco' && (
            <div className="mt-2 space-y-1 text-[11px]">
              {!feeLoading && !feeError && deliveryDistance !== null && (
                <p className="text-menu-text-soft">
                  Distância: {deliveryDistance.toFixed(2).replace('.', ',')} km
                </p>
              )}
              {feeError && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-amber-600">{feeError}</p>
                  {/* Só sugere "Marcar no Maps" quando realmente não temos
                      coords (geocoding falhou e cliente não colou manual). */}
                  {!coords && (
                    <button
                      type="button"
                      onClick={() => setManualOpen(true)}
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      Marcar localização no Google Maps
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer fixo */}
      <footer
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[768px] -translate-x-1/2 bg-gradient-to-t from-menu-bg via-menu-bg to-transparent px-4 pt-8 sm:px-6 md:px-8"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={handleAdvance}
          disabled={!canAdvance}
          className={`flex h-12 w-full items-center justify-center rounded-full px-4 text-base font-bold transition-all duration-200 active:scale-[0.99] ${
            canAdvance
              ? 'bg-menu-primary text-white shadow-[0_6px_18px_rgba(239,42,48,0.22)]'
              : 'bg-[#f0eaea] text-[#9b9292]'
          }`}
        >
          {canAdvance
            ? inTableMode
              ? 'Avançar'
              : 'Escolher forma de pagamento'
            : 'Escolha como receber o pedido'}
        </button>
      </footer>

      {showSavedSheet && (
        <SavedAddressSheet
          addresses={savedAddresses}
          selectedKey={makeAddressKey(address)}
          onClose={() => setShowSavedSheet(false)}
          onSelect={(picked) => {
            const newAddress = addressFromSaved(picked)
            setAddress(newAddress)
            setDeliveryMethod('endereco')
            setShowSavedSheet(false)
            setCoords(
              picked.latitude != null && picked.longitude != null
                ? { latitude: picked.latitude, longitude: picked.longitude }
                : null
            )
          }}
          onAddNew={() => {
            // Limpa pra sheet abrir vazio.
            setAddress(addressFromSaved(null))
            setShowSavedSheet(false)
            setShowAddressSheet(true)
          }}
          onRemove={(id) => {
            removeAddress(id)
            const next = listAddresses()
            setSavedAddresses(next)
            // Se apagou o que estava selecionado, limpa
            if (next.length === 0) {
              setShowSavedSheet(false)
              setDeliveryMethod(null)
              setAddress(addressFromSaved(null))
              setCoords(null)
            }
          }}
        />
      )}

      {showAddressSheet && (
        <AddressBottomSheet
          initial={address}
          neighborhoods={availableNeighborhoods}
          initialNeighborhoodId={selectedNeighborhoodId}
          onClose={() => setShowAddressSheet(false)}
          onSave={(saved, placesCoords, neighborhoodId) => {
            setAddress(saved)
            setDeliveryMethod('endereco')
            setShowAddressSheet(false)
            setSelectedNeighborhoodId(neighborhoodId ?? null)
            // Se modo bairro, coords não importam pro cálculo de taxa.
            // Caso contrário, reaplica coords vindas do Places se houver.
            setCoords(neighborhoodId ? null : (placesCoords ?? null))
          }}
        />
      )}

      <ManualCoordinatesModal
        isOpen={manualOpen}
        onClose={() => setManualOpen(false)}
        onConfirm={(c) => {
          setCoords(c)
          setManualOpen(false)
          setFeeError('')
          // Recalcula taxa com as coords manuais.
          if (deliveryMethod === 'endereco' && isAddressComplete(address)) {
            lookupDeliveryFee(
              {
                street: address.street.trim(),
                number: address.noNumber ? 'S/N' : address.number.trim(),
                neighborhood: address.neighborhood.trim() || undefined,
                city: address.city.trim() || undefined,
              },
              c
            )
          }
        }}
      />
    </div>
  )
}

function DeliveryMethodCard({
  label,
  description,
  onClick,
  children,
}: {
  label: string
  description: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-black/15 bg-white p-4 text-left shadow-[0_6px_20px_rgba(64,57,57,0.055)] transition-all duration-200 active:scale-[0.99]"
    >
      <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[16px] bg-menu-primary shadow-[0_5px_14px_rgba(239,42,48,0.22)]">
        {children}
      </span>
      <span className="mt-3 block text-[14px] font-semibold leading-none tracking-[-0.2px] text-menu-text">
        {label}
      </span>
      <span className="mt-1.5 block text-[11px] font-normal leading-[14px] tracking-[-0.1px] text-menu-text-soft">
        {description}
      </span>
      <span className="absolute right-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#f4eeee]">
        <span className="h-[7px] w-[7px] rounded-full bg-[#cfc6c6]" />
      </span>
    </button>
  )
}

function SelectedDeliveryCard({
  method,
  address,
  onChange,
  storeAddress,
}: {
  method: DeliveryMethodId
  address: AddressSheetState
  onChange: () => void
  storeAddress?: string
}) {
  const isPickup = method === 'retirar'

  return (
    <div
      className="rounded-[22px] bg-white px-4 py-4 shadow-[0_6px_20px_rgba(64,57,57,0.055)]"
      style={{ border: '0.6px solid rgba(65, 57, 57, 0.09)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-menu-text-soft">
            {isPickup ? 'Retirada no local' : 'Entrega no endereço'}
          </p>
          {isPickup ? (
            <p className="mt-2 text-[13px] font-medium leading-[1.4] text-menu-text">
              {storeAddress || 'Buscar no restaurante'}
            </p>
          ) : (
            <p className="mt-2 whitespace-pre-line text-[13px] font-medium leading-[1.4] text-menu-text">
              {[
                address.street && `${address.street}, ${address.noNumber ? 'S/N' : address.number}`,
                address.complement && address.complement,
                address.reference && `Ref: ${address.reference}`,
                address.neighborhood,
                address.city,
              ]
                .filter(Boolean)
                .join('\n')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onChange}
          className="flex h-[32px] shrink-0 items-center justify-center gap-1 rounded-[7px] bg-white px-3 text-[12px] font-semibold tracking-[-0.15px] text-menu-primary transition-transform active:scale-95"
          style={{ border: '0.8px solid rgba(239, 42, 48, 0.65)' }}
        >
          {isPickup ? 'Trocar' : 'Editar'}
        </button>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight,
  positive,
}: {
  label: string
  value: string
  highlight?: boolean
  positive?: boolean
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-menu-divider">
      <span
        className={`font-semibold tracking-[0] ${
          highlight
            ? 'text-lg text-menu-text'
            : positive
              ? 'text-sm text-green-600'
              : 'text-sm text-[#776d6d]'
        }`}
      >
        {label}
      </span>
      <strong
        className={`font-semibold tracking-[0] ${
          highlight
            ? 'text-lg text-menu-text'
            : positive
              ? 'text-sm text-green-600'
              : 'text-sm text-[#776d6d]'
        }`}
      >
        {value}
      </strong>
    </div>
  )
}

// Bottom-sheet com form de endereço — abre quando cliente toca em
// "Cadastrar endereço" ou em "Editar" no card de entrega selecionado.
//
// Quando o ViaCEP volta com CEP genérico (cidade-only sem rua), abrimos
// o Google Places Autocomplete pra cliente buscar pelo nome do logradouro
// — Places retorna lat/lng de quebra, então pulamos o geocoding posterior.
// Bottom-sheet com lista dos endereços salvos do cliente. Permite trocar
// pra outro endereço cadastrado, remover, ou adicionar um novo.
function SavedAddressSheet({
  addresses,
  selectedKey,
  onClose,
  onSelect,
  onAddNew,
  onRemove,
}: {
  addresses: SavedAddress[]
  selectedKey: string
  onClose: () => void
  onSelect: (addr: SavedAddress) => void
  onAddNew: () => void
  onRemove: (id: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 px-0"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement)?.closest('.pac-container')) e.stopPropagation()
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <section
        className="relative z-[81] max-h-[80dvh] w-full max-w-[768px] overflow-y-auto rounded-t-[30px] bg-menu-bg px-4 pt-3 shadow-[0_-16px_44px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        aria-label="Selecionar endereço de entrega"
      >
        <div className="mx-auto mb-4 h-[4px] w-11 rounded-full bg-[#403939]/20" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold leading-none tracking-[-0.3px] text-menu-text">
              Onde entregar?
            </h2>
            <p className="mt-2 text-[12px] font-normal leading-[17px] tracking-[-0.15px] text-[#817777]">
              Selecione um endereço salvo ou adicione um novo.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-menu-text shadow-[0_3px_12px_rgba(64,57,57,0.06)] active:scale-95"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {addresses.map((saved) => {
            const isSelected = makeSavedKey(saved) === selectedKey
            return (
              <div
                key={saved.id}
                className={`flex items-start gap-3 rounded-[18px] bg-white p-3 transition-colors ${
                  isSelected ? 'ring-2 ring-menu-primary' : 'ring-1 ring-[#403939]/8'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(saved)}
                  className="flex flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isSelected ? 'bg-menu-primary' : 'bg-[#f4eeee]'
                    }`}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path
                          d="M3.1 7.3L5.7 9.8L10.9 4.2"
                          stroke="white"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight text-menu-text">
                      {saved.street}, {saved.number}
                    </span>
                    {saved.complement && (
                      <span className="block text-[11px] text-menu-text-soft">
                        {saved.complement}
                      </span>
                    )}
                    <span className="block text-[11px] text-menu-text-soft">
                      {[saved.neighborhood, saved.city, saved.state].filter(Boolean).join(', ')}
                    </span>
                    {saved.zipCode && (
                      <span className="block text-[10px] text-menu-text-soft">
                        CEP {saved.zipCode}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${saved.street}`}
                  onClick={() => onRemove(saved.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-menu-text-soft transition-colors hover:bg-red-50 hover:text-menu-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M9 3H15M4 6H20M18 6L17.2 19.1C17.1 20.2 16.2 21 15.1 21H8.9C7.8 21 6.9 20.2 6.8 19.1L6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )
          })}

          <button
            type="button"
            onClick={onAddNew}
            className="mt-2 flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-menu-primary transition-transform active:scale-[0.99]"
            style={{ border: '1.5px dashed rgba(239, 42, 48, 0.5)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 5V19M5 12H19"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
              />
            </svg>
            Adicionar novo endereço
          </button>
        </div>
      </section>
    </div>
  )
}

function AddressBottomSheet({
  initial,
  neighborhoods,
  initialNeighborhoodId,
  onClose,
  onSave,
}: {
  initial: AddressSheetState
  neighborhoods: PublicNeighborhood[]
  initialNeighborhoodId: string | null
  onClose: () => void
  onSave: (
    addr: AddressSheetState,
    coords?: { latitude: number; longitude: number },
    neighborhoodId?: string | null
  ) => void
}) {
  const [draft, setDraft] = useState<AddressSheetState>(initial)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  // Quando ViaCEP/Google geocoding traz CEP genérico (sem rua), abrimos
  // Places. Cliente seleciona um resultado lá e preenche tudo de uma vez.
  const [needsPlaces, setNeedsPlaces] = useState(false)
  const [placeCoords, setPlaceCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  )
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(
    initialNeighborhoodId
  )
  const hasNeighborhoodMode = neighborhoods.length > 0
  // Quando a loja entrega por bairro, o sheet abre em modo bairro por padrão.
  // Cliente pode trocar pra CEP (form completo) via link no topo.
  // Se o cliente já tinha um endereço sem neighborhoodId salvo, abre em CEP.
  const [useCepMode, setUseCepMode] = useState<boolean>(
    !hasNeighborhoodMode || (!initialNeighborhoodId && isAddressComplete(initial))
  )
  const canSave = useCepMode
    ? isAddressComplete(draft)
    : !!selectedNeighborhoodId && !!draft.street.trim() && (!!draft.number.trim() || draft.noNumber)

  const update = <K extends keyof AddressSheetState>(field: K, value: AddressSheetState[K]) => {
    setDraft((d) => ({ ...d, [field]: value }))
    // Se cliente está editando manualmente, perde coords confiáveis do Places.
    if (field === 'street' || field === 'number' || field === 'neighborhood' || field === 'city') {
      setPlaceCoords(null)
    }
  }

  // Handler estável (referência fixa) pro AddressAutocomplete — evita
  // remontar o widget Google Places a cada render do bottom-sheet, o que
  // estaria descartando o `place_changed` listener do autocomplete novo.
  const handlePlaceSelect = useCallback((sel: AddressSelection) => {
    // eslint-disable-next-line no-console
    console.log(
      `[Places] coords gravadas: lat=${sel.latitude}, lng=${sel.longitude}`
    )
    setDraft((d) => ({
      ...d,
      cep: sel.cep ? formatCep(sel.cep) : d.cep,
      street: sel.street || d.street,
      number: sel.number || d.number,
      neighborhood: sel.neighborhood || d.neighborhood,
      city: sel.city || d.city,
      state: sel.state || d.state,
    }))
    setPlaceCoords({ latitude: sel.latitude, longitude: sel.longitude })
    setNeedsPlaces(false)
  }, [])

  // Auto-busca quando o cliente digita 8 dígitos no CEP. Sempre sobrescreve
  // rua/bairro/cidade/UF (cliente pode complementar com número/complemento
  // depois). Mudar o CEP = endereço novo. Coords pra taxa virão do Google
  // Geocoding no useEffect da CheckoutPage, depois que o sheet fechar.
  const handleCepChange = async (raw: string) => {
    const formatted = formatCep(raw)
    setCepError('')

    const digits = formatted.replace(/\D/g, '')

    // CEP incompleto: só limpa rua/bairro/cidade/UF se o cliente apagou um
    // que estava completo (qualquer dígito a menos invalida o endereço).
    if (digits.length !== 8) {
      setDraft((d) => ({
        ...d,
        cep: formatted,
        ...(d.cep.replace(/\D/g, '').length === 8
          ? { street: '', neighborhood: '', city: '', state: '' }
          : {}),
      }))
      return
    }

    // CEP completo: busca e SOBRESCREVE rua/bairro/cidade/UF.
    setCepLoading(true)
    try {
      const result = await lookupCepPublic(digits)
      const isGenericCep = !result.street || !result.neighborhood
      setDraft((d) => ({
        ...d,
        cep: formatted,
        street: result.street,
        neighborhood: result.neighborhood,
        city: result.city,
        state: result.state,
      }))
      // CEP genérico (cidade-only) — habilita Places pra cliente buscar
      // pelo nome do logradouro e pegar lat/lng mais precisa.
      setNeedsPlaces(isGenericCep)
      // Grava coords quando vieram do Google (source=google). Pra CEP de
      // rua específica, é a coordenada exata da via — pula geocoding extra
      // no submit. Pra CEP genérico, é o centroide da cidade — fica
      // como aproximação até o cliente refinar via Places ou números.
      if (result.latitude != null && result.longitude != null) {
        // eslint-disable-next-line no-console
        console.log(
          `[CEP] coords gravadas (source=${result.source}): lat=${result.latitude}, lng=${result.longitude}`
        )
        setPlaceCoords({ latitude: result.latitude, longitude: result.longitude })
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[CEP] sem coords (source=${result.source}) — geocoding posterior vai resolver`
        )
        setPlaceCoords(null)
      }
    } catch (err) {
      // Falhou a busca — limpa os campos pra cliente preencher manual com
      // confiança de que não sobrou dado de outro CEP.
      setDraft((d) => ({
        ...d,
        cep: formatted,
        street: '',
        neighborhood: '',
        city: '',
        state: '',
      }))
      setCepError(err instanceof Error ? err.message : 'CEP não encontrado')
      setNeedsPlaces(false)
      setPlaceCoords(null)
    } finally {
      setCepLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 px-0"
      // O dropdown do Google Places (`.pac-container`) é portalizado em
      // `document.body` — clicar numa sugestão dispara `mousedown` que
      // bubbla até aqui. Sem o guard, `onClose` rodaria e fecharia o sheet
      // ANTES do Google completar o `place_changed`. Essa proteção pula o
      // close quando a origem do click foi o pac-container.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement)?.closest('.pac-container')) {
          e.stopPropagation()
        }
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={(e) => {
          if ((e.target as HTMLElement)?.closest('.pac-container')) return
          onClose()
        }}
      />

      <section
        className="relative z-[81] max-h-[94dvh] min-h-[86dvh] w-full max-w-[768px] overflow-y-auto rounded-t-[30px] bg-menu-bg px-4 pt-3 shadow-[0_-16px_44px_rgba(0,0,0,0.18)] animate-[addressSheetUp_0.28s_ease-out]"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        aria-label="Cadastrar endereço de entrega"
      >
        <style>{`
          @keyframes addressSheetUp {
            from { transform: translateY(100%); opacity: 0.7; }
            to   { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        <div className="mx-auto mb-4 h-[4px] w-11 rounded-full bg-[#403939]/20" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold leading-none tracking-[-0.3px] text-menu-text">
              Endereço de entrega
            </h2>
            <p className="mt-2 text-[12px] font-normal leading-[17px] tracking-[-0.15px] text-[#817777]">
              Informe onde você deseja receber seu pedido.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-menu-text shadow-[0_3px_12px_rgba(64,57,57,0.06)] active:scale-95"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Toggle de modo (só quando loja tem bairros cadastrados).
            Modo bairro = select de bairro + rua + número (sem CEP/cidade).
            Modo CEP = fluxo completo com lookup automático. */}
        {hasNeighborhoodMode && (
          <button
            type="button"
            onClick={() => {
              setUseCepMode((v) => !v)
              // Limpa estado oposto pra não enviar dado misturado.
              if (!useCepMode) {
                // entrando em modo CEP
                setSelectedNeighborhoodId(null)
              } else {
                // voltando pra bairro
                setDraft((d) => ({ ...d, cep: '', city: '', state: '' }))
                setCepError('')
                setNeedsPlaces(false)
              }
            }}
            className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-menu-primary"
          >
            {useCepMode ? '← Selecionar bairro' : 'Buscar por endereço (CEP) →'}
          </button>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3">
          {/* CEP — auto-preenche os outros campos via /cep/lookup. Não bloqueia
              o cliente: se não souber, pode pular e preencher manual. */}
          {useCepMode && (
            <>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold leading-none tracking-[-0.1px] text-[#5f5656]">
                    CEP
                  </span>
                  {cepLoading && (
                    <span className="text-[10px] text-menu-text-soft">Buscando…</span>
                  )}
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={draft.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  className="h-[44px] w-full rounded-[15px] bg-white px-3 text-[13px] font-medium text-menu-text outline-none placeholder:text-[#aaa0a0]"
                  style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
                />
                {cepError && (
                  <span className="mt-1 block text-[10px] text-amber-600">
                    {cepError} — preencha os campos manualmente.
                  </span>
                )}
              </label>

              {/* Places fallback: ViaCEP retornou CEP genérico (sem rua/bairro). */}
              {needsPlaces && (
                <div className="rounded-[15px] bg-[#fff8f0] px-3 py-3" style={{ border: '0.6px solid rgba(202, 138, 4, 0.20)' }}>
                  <p className="mb-2 text-[11px] font-semibold leading-[14px] tracking-[-0.1px] text-amber-700">
                    Esse CEP é genérico — busque pelo nome da rua:
                  </p>
                  <AddressAutocomplete
                    onSelect={handlePlaceSelect}
                    placeholder="Ex: Rua Raul Soares, Salinas..."
                  />
                </div>
              )}
            </>
          )}

          <AddressField
            label="Rua / Avenida"
            placeholder="Ex: Rua Raul Soares"
            value={draft.street}
            onChange={(v) => update('street', v)}
          />

          {/* Número + chip "Sem número" */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <AddressField
              label="Número"
              placeholder="75"
              value={draft.number}
              disabled={draft.noNumber}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  number: v,
                  noNumber: v.trim().length > 0 ? false : d.noNumber,
                }))
              }
            />
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, noNumber: !d.noNumber, number: d.noNumber ? d.number : '' }))
              }
              className={`mb-[1px] flex h-[44px] shrink-0 items-center justify-center gap-2 px-1 text-[11px] font-semibold transition-all active:scale-[0.98] ${
                draft.noNumber ? 'text-menu-primary' : 'text-[#5f5656]'
              }`}
            >
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] transition-all duration-200 ${
                  draft.noNumber ? 'bg-menu-primary' : 'bg-[#d8d0d0]'
                }`}
                aria-hidden="true"
              >
                {draft.noNumber && (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M3.1 7.3L5.7 9.8L10.9 4.2"
                      stroke="white"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              Sem número
            </button>
          </div>

          {hasNeighborhoodMode && !useCepMode ? (
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold leading-none tracking-[-0.1px] text-[#5f5656]">
                Bairro <span className="text-menu-primary">*</span>
              </span>
              <select
                value={selectedNeighborhoodId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  setSelectedNeighborhoodId(id)
                  const picked = neighborhoods.find((n) => n.id === id)
                  if (picked) {
                    setDraft((d) => ({ ...d, neighborhood: picked.name }))
                  }
                }}
                className="h-[44px] w-full rounded-[15px] bg-white px-3 text-[13px] font-medium text-menu-text outline-none"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
              >
                <option value="">Selecione um bairro…</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-menu-text-soft">
                Atendemos apenas os bairros listados. Se o seu não estiver aqui, use a busca por
                CEP acima.
              </p>
            </div>
          ) : (
            <>
              <AddressField
                label="Bairro"
                placeholder="Centro"
                value={draft.neighborhood}
                onChange={(v) => update('neighborhood', v)}
              />
              <AddressField
                label="Cidade"
                placeholder="Salinas"
                value={draft.city}
                onChange={(v) => update('city', v)}
              />
            </>
          )}

          <AddressField
            label="Complemento"
            placeholder="Apartamento, casa, bloco..."
            value={draft.complement}
            onChange={(v) => update('complement', v)}
          />

          <AddressField
            label="Referência"
            placeholder="Próximo à praça, portão azul..."
            value={draft.reference}
            onChange={(v) => update('reference', v)}
          />

          <div className="pt-1">
            <span className="mb-2 block text-[11px] font-semibold leading-none tracking-[-0.1px] text-[#5f5656]">
              Nome do endereço
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['casa', 'trabalho', 'amigos'] as const).map((opt) => {
                const isSelected = draft.label === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update('label', opt)}
                    className={`flex h-[38px] items-center justify-center rounded-[14px] text-[12px] font-semibold capitalize transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-menu-primary text-white shadow-[0_5px_14px_rgba(239,42,48,0.20)]'
                        : 'bg-white text-[#5f5656]'
                    }`}
                    style={{
                      border: isSelected
                        ? '0.6px solid rgba(239, 42, 48, 0.25)'
                        : '0.6px solid rgba(65, 57, 57, 0.12)',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-[#6d6262] active:scale-[0.99]"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.12)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              canSave &&
              onSave(
                draft,
                placeCoords ?? undefined,
                useCepMode ? null : selectedNeighborhoodId
              )
            }
            disabled={!canSave}
            className={`flex h-[46px] flex-1 items-center justify-center rounded-full text-[14px] font-bold active:scale-[0.99] ${
              canSave
                ? 'bg-menu-primary text-white shadow-[0_6px_18px_rgba(239,42,48,0.22)]'
                : 'bg-[#f0eaea] text-[#9b9292]'
            }`}
          >
            Salvar endereço
          </button>
        </div>
      </section>
    </div>
  )
}

function AddressField({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold leading-none tracking-[-0.1px] text-[#5f5656]">
        {label}
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`h-[44px] w-full rounded-[15px] bg-white px-3 text-[13px] font-normal text-menu-text outline-none placeholder:text-[#aaa0a0] ${
          disabled ? 'opacity-50' : ''
        }`}
        style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
      />
    </label>
  )
}
