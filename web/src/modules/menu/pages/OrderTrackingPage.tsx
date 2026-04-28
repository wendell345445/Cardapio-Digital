import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { CheckCircle, Clock, ChefHat, Bike, Package, Copy, Check, MessageCircle, ArrowLeft, ListOrdered, XCircle } from 'lucide-react'

import { createPublicApi } from '../../../shared/lib/publicApi'

const menuApi = createPublicApi()

async function fetchOrderTracking(token: string) {
  const { data } = await menuApi.get(`/menu/pedido/${token}`)
  return data.data
}

interface StatusEntry { label: string; icon: React.ElementType; color: string; step: number }

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

// READY depende do tipo do pedido: em entrega, a loja ainda vai acionar um
// motoboy, então mantém "Em preparo" como último checkmark aceso (step 2).
// Em retirada/mesa, READY é o estado final antes de DELIVERED (step 3).
export function getStatusConfig(status: string, type: string): StatusEntry {
  if (status === 'READY') {
    return type === 'DELIVERY'
      ? { label: 'Pronto — aguardando motoboy', icon: Package, color: 'text-green-500', step: 2 }
      : { label: 'Pronto para retirada', icon: Package, color: 'text-green-500', step: 3 }
  }
  return STATUS_CONFIG[status] ?? { label: status, icon: Clock, color: 'text-gray-500', step: 0 }
}

const DELIVERY_STEPS = ['Confirmado', 'Em preparo', 'Saiu para entrega', 'Entregue']
const PICKUP_STEPS   = ['Confirmado', 'Em preparo', 'Pronto para retirada', 'Entregue']

interface OrderCreatedState {
  pixQrCode?: string
  pixCopyPaste?: string
  pixKey?: string
  pixKeyType?: string
}

export function OrderTrackingPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)

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

  const { data: order, isError } = useQuery({
    queryKey: ['order-tracking', token],
    queryFn: () => fetchOrderTracking(token!),
    initialData: location.state?.orderId ? undefined : undefined,
    staleTime: 30_000,
  })

  // Socket.io: atualiza em tempo real
  useEffect(() => {
    if (!order?.storeId) return
    const socket = io(import.meta.env.VITE_API_URL ?? '/', { auth: { storeId: order.storeId } })
    socket.on('order:status', (payload: { orderId: string; status: string }) => {
      if (payload.orderId === order.id) {
        qc.invalidateQueries({ queryKey: ['order-tracking', token] })
      }
    })
    return () => { socket.disconnect() }
  }, [order?.storeId, order?.id, token, qc])

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">😕</p>
          <h1 className="text-xl font-bold text-gray-800">Link inválido ou expirado</h1>
          <p className="text-gray-500 mt-2">Este link de acompanhamento não é mais válido.</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusConfig = getStatusConfig(order.status, order.type)
  const StatusIcon = statusConfig.icon
  const currentStep = statusConfig.step
  const steps = order.type === 'PICKUP' || order.type === 'TABLE' ? PICKUP_STEPS : DELIVERY_STEPS

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-green-500 text-white px-4 py-6 text-center">
        <p className="text-sm opacity-80">Pedido #{order.number}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <StatusIcon size={24} className="text-white" />
          <h1 className="text-xl font-bold">{statusConfig.label}</h1>
        </div>
        {order.type === 'DELIVERY' && order.address && (
          <p className="text-sm mt-2 opacity-80">
            Entrega: {(order.address as any).street}, {(order.address as any).number}
          </p>
        )}
        {order.type === 'PICKUP' && (
          <p className="text-sm mt-2 opacity-80">Retirada na loja</p>
        )}
        {order.type === 'TABLE' && (
          <p className="text-sm mt-2 opacity-80">Mesa {order.table?.number ?? ''}</p>
        )}
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Progress steps */}
        {order.status !== 'CANCELLED' && order.status !== 'WAITING_PAYMENT_PROOF' && order.status !== 'WAITING_CONFIRMATION' && (
          <section className="bg-white rounded-xl px-2 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < currentStep ? 'bg-green-500 text-white' :
                    i === currentStep - 1 ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <p className="text-[10px] text-center mt-1 text-gray-500 leading-tight">{step}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pix info */}
        {(order.status === 'WAITING_PAYMENT_PROOF') && (
          <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="font-semibold text-yellow-800 mb-1">⚡ Envie o comprovante Pix</p>
            <p className="text-sm text-yellow-700">Após o pagamento, envie o comprovante via WhatsApp para confirmar seu pedido.</p>
          </section>
        )}

        {/* Pix QR Code e Copia e Cola */}
        {order.status === 'WAITING_PAYMENT_PROOF' && orderCreatedState?.pixQrCode && orderCreatedState?.pixCopyPaste && (
          <section className="bg-white rounded-xl p-4 shadow-sm text-center space-y-4">
            <h2 className="font-bold text-gray-800 text-base">Pagamento via Pix</h2>

            <img
              src={orderCreatedState.pixQrCode}
              alt="QR Code Pix"
              className="w-48 h-48 mx-auto"
            />

            {orderCreatedState.pixKey && (
              <p className="text-xs text-gray-500">
                Chave Pix ({orderCreatedState.pixKeyType ?? 'RANDOM'}): <span className="font-mono break-all">{orderCreatedState.pixKey}</span>
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Pix Copia e Cola</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={orderCreatedState.pixCopyPaste}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 overflow-hidden text-ellipsis"
                />
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium min-h-[44px] whitespace-nowrap"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Após o pagamento, envie o comprovante via WhatsApp para confirmar seu pedido.
            </p>
          </section>
        )}

        {/* Items */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">Itens do pedido</h2>
          <div className="space-y-2">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}x {item.productName}
                  {item.variationName ? ` (${item.variationName})` : ''}
                </span>
                <span className="font-medium text-gray-800">
                  {item.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto</span>
                <span>- {order.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Taxa de entrega</span>
                <span>{order.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-gray-900">
              <span>Total</span>
              <span>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          </div>
        </section>

        {/* Pedido cancelado: mostra motivo no lugar do opt-in WhatsApp */}
        {order.status === 'CANCELLED' ? (
          <section className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-red-800">Pedido cancelado</p>
              <p className="text-xs text-red-700 mt-0.5">
                {order.cancellationReason
                  ? `Motivo: ${order.cancellationReason}`
                  : 'Este pedido foi cancelado pela loja.'}
              </p>
            </div>
          </section>
        ) : (
          /* TASK-130: opt-in para receber atualizações por WhatsApp */
          <OptInCard order={order} />
        )}

        {/* TABLE: navegação para comanda e menu */}
        {order.type === 'TABLE' && (
          <section className="space-y-2">
            <a
              href="/comanda"
              className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
            >
              Ver comanda completa da mesa
            </a>
            <a
              href={`/?mesa=${order.table?.number ?? ''}`}
              className="block w-full text-center border-2 border-green-500 text-green-600 font-bold py-3.5 rounded-xl text-sm transition-colors hover:bg-green-50"
            >
              Voltar ao cardapio e pedir mais
            </a>
          </section>
        )}

        {/* TASK-130: navegação geral pós-pedido */}
        <section className="grid grid-cols-2 gap-2 pt-1">
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 border-2 border-gray-200 text-gray-700 hover:border-gray-300 font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            <ArrowLeft size={14} />
            Cardápio
          </Link>
          <Link
            to="/meus-pedidos"
            className="flex items-center justify-center gap-1.5 border-2 border-gray-200 text-gray-700 hover:border-gray-300 font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            <ListOrdered size={14} />
            Meus pedidos
          </Link>
        </section>
      </div>
    </div>
  )
}

// Card de opt-in para notificações via WhatsApp.
// Some quando notifyOnStatusChange já é true (cliente já fez opt-in).
// TASK-130 (parte 2): o número usado no link wa.me é o REALMENTE pareado no
// Baileys da loja (Store.whatsappPairedNumber). Esse é o número que recebe
// inbound — sem ele, o opt-in não funciona, então escondemos o card.
function OptInCard({ order }: { order: { number: number; notifyOnStatusChange?: boolean; store?: { whatsappPairedNumber?: string | null } } }) {
  if (order.notifyOnStatusChange) {
    return (
      <section className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <MessageCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-green-800">
          <p className="font-semibold">Notificações ativas</p>
          <p className="text-xs text-green-700 mt-0.5">
            Você receberá atualizações deste pedido pelo WhatsApp.
          </p>
        </div>
      </section>
    )
  }

  // whatsappPairedNumber já vem com prefixo de país (ex: "5538984091451"),
  // porque o Baileys salva nesse formato. Se não estiver pareada, escondemos.
  const pairedNumber = (order.store?.whatsappPairedNumber ?? '').replace(/\D/g, '')
  if (!pairedNumber) return null

  const message = `Olá, quero receber status do meu pedido #${order.number}`
  const waLink = `https://wa.me/${pairedNumber}?text=${encodeURIComponent(message)}`

  return (
    <section className="bg-white border border-green-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-gray-800 text-sm">Acompanhar pelo WhatsApp?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Toque no botão abaixo, vamos abrir o WhatsApp com uma mensagem pronta —
            é só enviar e você recebe cada atualização do pedido.
          </p>
        </div>
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
      >
        Receber atualizações pelo WhatsApp
      </a>
    </section>
  )
}
