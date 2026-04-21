import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import axios from 'axios'
import { CheckCircle, Clock, ChefHat, Bike, Package, Copy, Check } from 'lucide-react'

// Dev: relativo (proxy do Vite). Prod: VITE_API_URL absoluto.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

const menuApi = axios.create({ baseURL })

async function fetchOrderTracking(token: string) {
  const { data } = await menuApi.get(`/menu/pedido/${token}`)
  return data.data
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; step: number }> = {
  WAITING_PAYMENT_PROOF: { label: 'Aguardando comprovante Pix', icon: Clock, color: 'text-yellow-500', step: 0 },
  WAITING_CONFIRMATION:  { label: 'Aguardando confirmação',     icon: Clock, color: 'text-yellow-500', step: 0 },
  CONFIRMED:             { label: 'Confirmado',                  icon: CheckCircle, color: 'text-blue-500', step: 1 },
  PREPARING:             { label: 'Em preparo',                  icon: ChefHat, color: 'text-orange-500', step: 2 },
  READY:                 { label: 'Pronto',                      icon: CheckCircle, color: 'text-green-500', step: 3 },
  DISPATCHED:            { label: 'Saiu para entrega',           icon: Bike, color: 'text-purple-500', step: 3 },
  DELIVERED:             { label: 'Entregue',                    icon: Package, color: 'text-green-500', step: 4 },
  CANCELLED:             { label: 'Cancelado',                   icon: Clock, color: 'text-red-500', step: -1 },
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

  const statusConfig = STATUS_CONFIG[order.status] ?? { label: order.status, icon: Clock, color: 'text-gray-500', step: 0 }
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
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Progress steps */}
        {order.status !== 'CANCELLED' && order.status !== 'WAITING_PAYMENT_PROOF' && order.status !== 'WAITING_CONFIRMATION' && (
          <section className="bg-white rounded-xl p-4 shadow-sm">
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
                  <p className="text-xs text-center mt-1 text-gray-500 leading-tight">{step}</p>
                  {i < steps.length - 1 && (
                    <div className={`absolute h-0.5 w-full ${i < currentStep - 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
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
      </div>
    </div>
  )
}
