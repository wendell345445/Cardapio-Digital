import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import {
  CheckCircle,
  Clock,
  ChefHat,
  Bike,
  Package,
  Copy,
  Check,
  MessageCircle,
  ArrowLeft,
  ListOrdered,
  XCircle,
} from 'lucide-react'

import { OrderSentAnimation } from '../components/OrderSentAnimation'

import { createPublicApi } from '@/shared/lib/publicApi'

const menuApi = createPublicApi()

async function fetchOrderTracking(token: string) {
  const { data } = await menuApi.get(`/menu/pedido/${token}`)
  return data.data
}

interface StatusEntry {
  label: string
  icon: React.ElementType
  color: string
  step: number
}

const STATUS_CONFIG: Record<string, StatusEntry> = {
  WAITING_PAYMENT_PROOF: { label: 'Aguardando comprovante Pix', icon: Clock, color: 'text-yellow-500', step: 0 },
  WAITING_CONFIRMATION:  { label: 'Aguardando confirmação',     icon: Clock, color: 'text-yellow-500', step: 0 },
  CONFIRMED:             { label: 'Confirmado',                  icon: CheckCircle, color: 'text-blue-500', step: 1 },
  PREPARING:             { label: 'Em preparo',                  icon: ChefHat, color: 'text-orange-500', step: 2 },
  READY:                 { label: 'Pronto',                      icon: CheckCircle, color: 'text-green-500', step: 3 },
  DISPATCHED:            { label: 'Saiu para entrega',           icon: Bike, color: 'text-purple-500', step: 3 },
  DELIVERED:             { label: 'Entregue',                    icon: Package, color: 'text-green-500', step: 4 },
  CANCELLED:             { label: 'Cancelado',                   icon: Clock, color: 'text-red-500', step: -1 },
}

// READY depende do tipo do pedido — em entrega, "Em preparo" continua aceso
// até DISPATCHED. Em retirada/mesa, READY é o estado final antes de DELIVERED.
export function getStatusConfig(status: string, type: string): StatusEntry {
  if (status === 'READY') {
    return type === 'DELIVERY'
      ? { label: 'Pronto — aguardando motoboy', icon: Package, color: 'text-green-500', step: 2 }
      : { label: 'Pronto para retirada', icon: Package, color: 'text-green-500', step: 3 }
  }
  return STATUS_CONFIG[status] ?? { label: status, icon: Clock, color: 'text-gray-500', step: 0 }
}

const DELIVERY_STEPS = ['Confirmado', 'Em preparo', 'Saiu para entrega', 'Entregue']
const PICKUP_STEPS = ['Confirmado', 'Em preparo', 'Pronto para retirada', 'Entregue']

interface OrderCreatedState {
  pixQrCode?: string
  pixCopyPaste?: string
  pixKey?: string
  pixKeyType?: string
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function OrderTrackingPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [pixKeyCopied, setPixKeyCopied] = useState(false)

  const orderCreatedState = location.state as OrderCreatedState | null

  const handleCopyPix = async () => {
    if (!orderCreatedState?.pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(orderCreatedState.pixCopyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback silencioso
    }
  }

  const handleCopyPixKey = async () => {
    if (!orderCreatedState?.pixKey) return
    try {
      await navigator.clipboard.writeText(orderCreatedState.pixKey)
      setPixKeyCopied(true)
      setTimeout(() => setPixKeyCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const { data: order, isError } = useQuery({
    queryKey: ['order-tracking', token],
    queryFn: () => fetchOrderTracking(token!),
    initialData: location.state?.orderId ? undefined : undefined,
    staleTime: 30_000,
  })

  // Socket.io: atualiza em tempo real (status, cancelamento, etc).
  // Cliente entra na room `store:${storeId}` igual ao admin — recebe os
  // eventos `order:status` que o admin emite ao mudar status (incluindo
  // cancelamento) e invalida a query pra refetch + UI atualiza sozinha.
  useEffect(() => {
    if (!order?.storeId) return
    const socket = io(import.meta.env.VITE_API_URL ?? '/', {
      auth: { storeId: order.storeId },
    })
    socket.on('order:status', (payload: { orderId: string; status: string }) => {
      if (payload.orderId === order.id) {
        qc.invalidateQueries({ queryKey: ['order-tracking', token] })
      }
    })
    return () => {
      socket.disconnect()
    }
  }, [order?.storeId, order?.id, token, qc])

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-menu-bg px-4 [font-family:'Sen',Helvetica] antialiased">
        <div className="text-center">
          <p className="mb-4 text-4xl">😕</p>
          <h1 className="text-xl font-bold text-menu-text">Link inválido ou expirado</h1>
          <p className="mt-2 text-menu-text-soft">Este link de acompanhamento não é mais válido.</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-menu-bg [font-family:'Sen',Helvetica] antialiased">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-menu-primary border-t-transparent" />
      </div>
    )
  }

  const statusConfig = getStatusConfig(order.status, order.type)
  const StatusIcon = statusConfig.icon
  const currentStep = statusConfig.step
  const steps = order.type === 'PICKUP' || order.type === 'TABLE' ? PICKUP_STEPS : DELIVERY_STEPS

  const showHero = order.status === 'WAITING_PAYMENT_PROOF' || order.status === 'WAITING_CONFIRMATION'

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <div className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg px-4 sm:px-6 md:px-8">
        {/* Header gradiente */}
        <header
          className="-mx-4 flex flex-col items-center px-4 py-6 text-white sm:-mx-6 sm:px-6 md:-mx-8 md:px-8"
          style={{
            background:
              'linear-gradient(135deg, var(--menu-gradient-from) 0%, var(--menu-gradient-to) 100%)',
          }}
        >
          <p className="text-sm opacity-80">Pedido #{order.number}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusIcon size={22} className="text-white" />
            <h1 className="text-[20px] font-bold">{statusConfig.label}</h1>
          </div>
          {order.type === 'DELIVERY' && order.address && (
            <p className="mt-2 text-sm opacity-80">
              Entrega: {order.address.street}, {order.address.number}
            </p>
          )}
          {order.type === 'PICKUP' && <p className="mt-2 text-sm opacity-80">Retirada na loja</p>}
          {order.type === 'TABLE' && (
            <p className="mt-2 text-sm opacity-80">Mesa {order.table?.number ?? ''}</p>
          )}
        </header>

        <main className="flex-1 space-y-5 py-6">
          {/* Hero animação chef + total — visível enquanto aguarda confirmação/comprovante */}
          {showHero && (
            <section
              aria-labelledby="pedido-enviado-heading"
              className="flex w-full flex-col items-center"
            >
              <OrderSentAnimation />

              <div className="mt-2.5 flex items-center justify-center gap-1.5">
                <CheckCircle className="h-[18px] w-[18px] text-[#32a852]" />
                <h2
                  id="pedido-enviado-heading"
                  className="text-[22px] font-semibold leading-[26px] text-[#5f5a5a]"
                >
                  Pedido enviado
                </h2>
              </div>

              <div
                className="mt-3.5 w-full max-w-[236px] overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_rgba(64,57,57,0.07)]"
                style={{ border: '0.6px solid rgba(65, 57, 57, 0.10)' }}
              >
                <div
                  className="h-[3px] w-full"
                  style={{
                    background:
                      'linear-gradient(90deg, color-mix(in srgb, var(--menu-gradient-from) 18%, transparent) 0%, color-mix(in srgb, var(--menu-gradient-to) 55%, transparent) 50%, color-mix(in srgb, var(--menu-gradient-from) 18%, transparent) 100%)',
                  }}
                />
                <div className="flex flex-col items-center px-5 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.9px] text-[#9a8f8f]">
                    Total do pedido
                  </span>
                  <strong className="mt-1.5 text-[32px] font-semibold leading-none tracking-[-0.7px] text-menu-text">
                    {fmt(order.total)}
                  </strong>
                  <span className="mt-1.5 h-[4px] w-[34px] rounded-full bg-menu-primary/15" />
                </div>
              </div>
            </section>
          )}

          {/* Stepper de status — esconde nos estados iniciais e cancelado */}
          {order.status !== 'CANCELLED' &&
            order.status !== 'WAITING_PAYMENT_PROOF' &&
            order.status !== 'WAITING_CONFIRMATION' && (
              <section className="rounded-[14px] bg-white px-2 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between">
                  {steps.map((step, i) => (
                    <div key={step} className="flex flex-1 flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          i < currentStep
                            ? 'bg-menu-primary text-white'
                            : i === currentStep - 1
                              ? 'bg-menu-primary text-white'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {i < currentStep ? '✓' : i + 1}
                      </div>
                      <p className="mt-1 text-center text-[10px] leading-tight text-menu-text-soft">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Bloco PIX */}
          {order.status === 'WAITING_PAYMENT_PROOF' &&
            orderCreatedState?.pixQrCode &&
            orderCreatedState?.pixCopyPaste && (
              <section
                aria-label="Pagamento via Pix"
                className="flex flex-col gap-3.5 rounded-[14px] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
              >
                <h2 className="text-center text-[14px] font-bold text-menu-text">
                  Pagamento via Pix
                </h2>

                <img
                  src={orderCreatedState.pixQrCode}
                  alt="QR Code Pix"
                  className="mx-auto h-48 w-48"
                />

                {orderCreatedState.pixKey && (
                  <div
                    className="flex h-[42px] w-full items-center justify-between gap-2 rounded-[8px] bg-white px-3 shadow-[0_2px_8px_rgba(64,57,57,0.04)]"
                    style={{ border: '0.6px solid rgba(65, 57, 57, 0.28)' }}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-menu-text">
                      {orderCreatedState.pixKey}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPixKey}
                      aria-label={`Copiar chave Pix ${orderCreatedState.pixKey}`}
                      className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-menu-text transition-opacity active:opacity-70"
                    >
                      <span>{pixKeyCopied ? 'Copiado' : 'Copiar Chave'}</span>
                      {pixKeyCopied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-menu-text-soft">Pix Copia e Cola</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={orderCreatedState.pixCopyPaste}
                      className="flex-1 overflow-hidden text-ellipsis rounded-[10px] border border-menu-card-border bg-[#fafafa] px-3 py-2 font-mono text-xs text-menu-text"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="flex min-h-[40px] items-center gap-1 whitespace-nowrap rounded-[10px] bg-menu-primary px-3 py-2 text-sm font-bold text-white shadow-menu-md active:scale-[0.98]"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div
                  className="rounded-[8px] bg-[#e9f5fa] px-3 py-2.5"
                  style={{ border: '0.6px solid rgba(61, 129, 158, 0.16)' }}
                >
                  <p className="text-center text-[12px] leading-[18px] text-menu-text">
                    Faça o pagamento via Pix no app do seu banco e nos envie o comprovante para
                    confirmação.
                  </p>
                </div>
              </section>
            )}

          {/* Itens */}
          <section className="rounded-[14px] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
            <h2 className="mb-3 text-[14px] font-bold text-menu-text">Itens do pedido</h2>
            <div className="space-y-2">
              {order.items.map((item: {
                id: string
                quantity: number
                productName: string
                variationName?: string
                totalPrice: number
              }) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-menu-text">
                    {item.quantity}x {item.productName}
                    {item.variationName ? ` (${item.variationName})` : ''}
                  </span>
                  <span className="font-medium text-menu-text">{fmt(item.totalPrice)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-menu-divider pt-3 text-sm">
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto</span>
                  <span>- {fmt(order.discount)}</span>
                </div>
              )}
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-menu-text-soft">
                  <span>Taxa de entrega</span>
                  <span>{fmt(order.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-menu-text">
                <span>Total</span>
                <span>{fmt(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Cancelado / Opt-in WhatsApp */}
          {order.status === 'CANCELLED' ? (
            <section className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4">
              <XCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
              <div className="text-sm">
                <p className="font-semibold text-red-800">Pedido cancelado</p>
                <p className="mt-0.5 text-xs text-red-700">
                  {order.cancellationReason
                    ? `Motivo: ${order.cancellationReason}`
                    : 'Este pedido foi cancelado pela loja.'}
                </p>
              </div>
            </section>
          ) : order.type !== 'TABLE' ? (
            <OptInCard order={order} />
          ) : null}

          {/* Mesa */}
          {order.type === 'TABLE' && (
            <section className="space-y-2">
              <Link
                to="/comanda"
                className="block w-full rounded-full bg-menu-primary py-3.5 text-center text-sm font-bold text-white shadow-menu-md active:scale-[0.98]"
              >
                Ver comanda completa da mesa
              </Link>
              <Link
                to="/"
                className="block w-full rounded-full border-2 border-menu-primary py-3.5 text-center text-sm font-bold text-menu-primary transition-colors hover:bg-menu-primary/10"
              >
                Voltar ao cardápio e pedir mais
              </Link>
            </section>
          )}

          {/* Navegação geral pós-pedido */}
          {order.type !== 'TABLE' && (
            <section className="grid grid-cols-2 gap-2 pt-1">
              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 rounded-full border border-menu-card-border py-3 text-sm font-semibold text-menu-text hover:border-menu-text-soft"
              >
                <ArrowLeft size={14} />
                Cardápio
              </Link>
              <Link
                to="/meus-pedidos"
                className="flex items-center justify-center gap-1.5 rounded-full border border-menu-card-border py-3 text-sm font-semibold text-menu-text hover:border-menu-text-soft"
              >
                <ListOrdered size={14} />
                Meus pedidos
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

// Card de opt-in para notificações via WhatsApp.
// Some quando notifyOnStatusChange já é true (cliente já fez opt-in).
function OptInCard({
  order,
}: {
  order: {
    number: number
    notifyOnStatusChange?: boolean
    store?: { whatsappPairedNumber?: string | null }
  }
}) {
  if (order.notifyOnStatusChange) {
    return (
      <section className="flex items-start gap-3 rounded-[14px] border border-green-200 bg-green-50 p-4">
        <MessageCircle size={20} className="mt-0.5 shrink-0 text-green-600" />
        <div className="text-sm text-green-800">
          <p className="font-semibold">Notificações ativas</p>
          <p className="mt-0.5 text-xs text-green-700">
            Você receberá atualizações deste pedido pelo WhatsApp.
          </p>
        </div>
      </section>
    )
  }

  // whatsappPairedNumber já vem com prefixo de país. Sem ele, o opt-in não funciona.
  const pairedNumber = (order.store?.whatsappPairedNumber ?? '').replace(/\D/g, '')
  if (!pairedNumber) return null

  const message = `Olá, quero receber status do meu pedido #${order.number}`
  const waLink = `https://wa.me/${pairedNumber}?text=${encodeURIComponent(message)}`

  return (
    <section className="space-y-3 rounded-[14px] border border-green-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="mt-0.5 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-bold text-menu-text">Acompanhar pelo WhatsApp?</p>
          <p className="mt-0.5 text-xs text-menu-text-soft">
            Toque no botão abaixo, vamos abrir o WhatsApp com uma mensagem pronta — é só enviar e
            você recebe cada atualização do pedido.
          </p>
        </div>
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-full bg-green-500 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-green-600"
      >
        Receber atualizações pelo WhatsApp
      </a>
    </section>
  )
}
