// ─── A-056: Comanda pública do cliente ───────────────────────────────────────

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { ChefHat, Clock, CheckCircle, UtensilsCrossed } from 'lucide-react'

import { useCartStore } from '../store/useCartStore'
import { useCustomerComanda, useRequestCheck } from '../hooks/useComanda'
import type { ComandaItem } from '../services/comanda.service'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  PENDING:   { label: 'Pendente',   icon: Clock,       bg: 'bg-yellow-100', text: 'text-yellow-700' },
  PREPARING: { label: 'Preparando', icon: ChefHat,     bg: 'bg-orange-100', text: 'text-orange-700' },
  DELIVERED: { label: 'Entregue',   icon: CheckCircle, bg: 'bg-green-100',  text: 'text-green-700'  },
}

function ItemRow({ item }: { item: ComandaItem }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING
  const Icon = cfg.icon

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">
          {item.quantity}x {item.productName}
          {item.variationName && (
            <span className="text-gray-500 font-normal"> — {item.variationName}</span>
          )}
        </p>
        {item.additionals.length > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">
            + {item.additionals.map((a) => a.name).join(', ')}
          </p>
        )}
        {item.notes && (
          <p className="text-xs text-gray-400 mt-0.5">Obs: {item.notes}</p>
        )}
        <p className="text-xs text-gray-600 mt-1 font-medium">{fmt(item.totalPrice)}</p>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.bg} ${cfg.text}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    </div>
  )
}

export function ComandaPage() {
  const tableNumber = useCartStore((s) => s.tableNumber)
  const queryClient = useQueryClient()
  const { data: comanda, isLoading, isError } = useCustomerComanda(tableNumber)
  const requestCheckMutation = useRequestCheck()
  const [checkRequested, setCheckRequested] = useState(false)

  // Socket.io: real-time item status updates
  useEffect(() => {
    if (!comanda?.storeId || !comanda?.table?.id) return
    const socket = io(import.meta.env.VITE_API_URL ?? '/', {
      auth: { storeId: comanda.storeId },
    })
    socket.emit('join-table', comanda.table.id)
    socket.on('item:status', () => {
      queryClient.invalidateQueries({ queryKey: ['customer-comanda', tableNumber] })
    })
    return () => { socket.disconnect() }
  }, [comanda?.storeId, comanda?.table?.id, tableNumber, queryClient])

  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h1 className="text-lg font-bold text-gray-800">Nenhuma mesa selecionada</h1>
          <p className="text-sm text-gray-500 mt-1">Escaneie o QR code da mesa para acessar a comanda.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !comanda) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <p className="text-4xl mb-3">😕</p>
          <h1 className="text-lg font-bold text-gray-800">Erro ao carregar comanda</h1>
          <p className="text-sm text-gray-500 mt-1">Verifique sua conexao e tente novamente.</p>
        </div>
      </div>
    )
  }

  const handleRequestCheck = async () => {
    try {
      await requestCheckMutation.mutateAsync(tableNumber)
      setCheckRequested(true)
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <header className="bg-green-500 text-white px-4 py-5 text-center">
        <p className="text-sm opacity-80 uppercase tracking-wide font-medium">Comanda</p>
        <h1 className="text-2xl font-bold mt-1">Mesa {comanda.table.number}</h1>
        <p className="text-sm opacity-80 mt-1">
          {comanda.items.length} {comanda.items.length === 1 ? 'item' : 'itens'}
          {comanda.orders.length > 1 && ` em ${comanda.orders.length} pedidos`}
        </p>
      </header>

      {/* Items */}
      <div className="flex-1 px-4 py-4">
        {comanda.items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">Nenhum item na comanda.</p>
          </div>
        ) : (
          <section className="bg-white rounded-xl p-4 shadow-sm">
            {comanda.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </section>
        )}

        {/* Total */}
        {comanda.items.length > 0 && (
          <section className="bg-white rounded-xl p-4 shadow-sm mt-3">
            <div className="flex justify-between font-bold text-base text-gray-900">
              <span>Total</span>
              <span>{fmt(comanda.total)}</span>
            </div>
          </section>
        )}
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
        <a
          href={`/?mesa=${tableNumber}`}
          className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Pedir mais
        </a>
        <button
          onClick={handleRequestCheck}
          disabled={checkRequested || requestCheckMutation.isPending}
          className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-xl text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checkRequested
            ? 'Conta solicitada'
            : requestCheckMutation.isPending
              ? 'Solicitando...'
              : 'Pedir a conta'}
        </button>
        {requestCheckMutation.isError && (
          <p className="text-red-500 text-xs text-center">Erro ao solicitar a conta. Tente novamente.</p>
        )}
      </div>
    </div>
  )
}
