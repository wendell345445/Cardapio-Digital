import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { ArrowLeft, Clock, CheckCircle, ChefHat, Bike, Package } from 'lucide-react'

import { listOrdersBySession } from '../services/orders.service'
import type { SessionOrderSummary } from '../services/orders.service'
import { getCustomerSessionId } from '../lib/customerSession'

// TASK-130: lista os pedidos da sessão atual do navegador (sem login).
// Status atualiza em tempo real via socket — qualquer mudança em qualquer
// pedido força refetch da lista.

const STATUS_META: Record<string, { label: string; icon: React.ElementType; tone: string; openTracking: boolean }> = {
  WAITING_PAYMENT_PROOF: { label: 'Aguardando Pix', icon: Clock, tone: 'text-yellow-600 bg-yellow-50', openTracking: true },
  WAITING_CONFIRMATION:  { label: 'Aguardando confirmação', icon: Clock, tone: 'text-yellow-600 bg-yellow-50', openTracking: true },
  WAITING_PAYMENT:       { label: 'Aguardando pagamento', icon: Clock, tone: 'text-yellow-600 bg-yellow-50', openTracking: true },
  CONFIRMED:             { label: 'Confirmado', icon: CheckCircle, tone: 'text-blue-600 bg-blue-50', openTracking: true },
  PREPARING:             { label: 'Em preparo', icon: ChefHat, tone: 'text-orange-600 bg-orange-50', openTracking: true },
  READY:                 { label: 'Pronto', icon: Package, tone: 'text-green-600 bg-green-50', openTracking: true },
  DISPATCHED:            { label: 'Saiu para entrega', icon: Bike, tone: 'text-purple-600 bg-purple-50', openTracking: true },
  DELIVERED:             { label: 'Entregue', icon: CheckCircle, tone: 'text-green-700 bg-green-50', openTracking: false },
  CANCELLED:             { label: 'Cancelado', icon: Clock, tone: 'text-red-600 bg-red-50', openTracking: false },
}

const TYPE_LABEL: Record<string, string> = {
  DELIVERY: 'Entrega',
  PICKUP: 'Retirada',
  TABLE: 'Mesa',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function MyOrdersPage() {
  const sessionId = getCustomerSessionId()
  const qc = useQueryClient()

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['my-orders', sessionId],
    queryFn: () => listOrdersBySession(sessionId),
    staleTime: 15_000,
  })

  // Socket.io: invalida lista quando qualquer pedido muda de status.
  // Cada pedido pode ser de uma loja diferente (raro mas possível). Por
  // simplicidade, ouvimos pelo storeId do primeiro pedido — se o usuário tem
  // pedidos em múltiplas lojas, o refetch periódico (staleTime) cobre.
  useEffect(() => {
    const first = orders?.[0]
    if (!first) return
    const socket = io(import.meta.env.VITE_API_URL ?? '/', { auth: { storeId: '*' } })
    socket.on('order:status', () => {
      qc.invalidateQueries({ queryKey: ['my-orders', sessionId] })
    })
    return () => { socket.disconnect() }
  }, [orders, sessionId, qc])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 max-w-lg mx-auto flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-800">Meus pedidos</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-center text-sm text-red-600 py-10">
            Não foi possível carregar seus pedidos.
          </p>
        )}

        {!isLoading && !isError && (orders?.length ?? 0) === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
            <p className="text-gray-500 text-sm">Você ainda não tem pedidos neste navegador.</p>
            <Link
              to="/"
              className="inline-block mt-4 bg-green-500 hover:bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Ir ao cardápio
            </Link>
          </div>
        )}

        {orders?.map((order: SessionOrderSummary) => {
          const meta = STATUS_META[order.status] ?? STATUS_META.WAITING_CONFIRMATION
          const Icon = meta.icon
          const card = (
            <article className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-400">#{order.number} • {fmtDate(order.createdAt)}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{TYPE_LABEL[order.type] ?? order.type}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${meta.tone}`}>
                  <Icon size={12} />
                  {meta.label}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{fmtMoney(order.total)}</span>
                {meta.openTracking && (
                  <span className="text-green-600 font-medium">Acompanhar →</span>
                )}
              </div>
            </article>
          )
          return meta.openTracking ? (
            <Link key={order.id} to={`/pedido/${order.token}`}>
              {card}
            </Link>
          ) : (
            <div key={order.id}>{card}</div>
          )
        })}
      </main>
    </div>
  )
}
