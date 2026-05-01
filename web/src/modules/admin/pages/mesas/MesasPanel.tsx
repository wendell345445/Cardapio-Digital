import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useTables } from '../../hooks/useTables'
import type { TableWithComanda } from '../../services/tables.service'

import { MesaDetailDrawer } from './MesaDetailDrawer'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'
import { useSocket } from '@/shared/hooks/useSocket'
import { playBeep } from '@/shared/lib/sounds'
import { toast } from '@/shared/lib/toast'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  const remMin = min % 60
  return `há ${h}h${remMin ? ` ${remMin}min` : ''}`
}

interface CardStatus {
  label: string
  color: string
  bg: string
  border: string
  pulse?: boolean
}

function deriveStatus(table: TableWithComanda): CardStatus {
  const session = table.sessions?.[0]
  if (!session) {
    return { label: 'Livre', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' }
  }
  // Cliente pediu a conta — prioridade máxima (garçom precisa atender).
  // Vence "Pedido novo" porque já implica que cliente terminou de pedir.
  if (session.checkRequestedAt && !session.isPaid) {
    return {
      label: 'Conta pedida',
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      pulse: true,
    }
  }
  // Pedido novo aguardando confirmação ou Pix → vermelho pulsando.
  // Mas se TODOS os itens do pedido WAITING já saíram de PENDING, o garçom já
  // começou a atender — não é mais "novo" do ponto de vista da UI, mesmo que
  // o auto-confirm do backend ainda não tenha rodado (pedidos antigos pré-v2.7).
  const hasNew = session.orders?.some((o) => {
    const isWaiting = o.status === 'WAITING_CONFIRMATION' || o.status === 'WAITING_PAYMENT_PROOF'
    if (!isWaiting) return false
    const items = o.items ?? []
    if (items.length === 0) return true // sem itens carregados → conservador
    return items.some((i) => i.status === 'PENDING')
  })
  if (hasNew) {
    return {
      label: 'Pedido novo',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-300',
      pulse: true,
    }
  }
  if (session.isPaid) {
    return {
      label: 'Pago — pode fechar',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    }
  }
  // Sessão aberta mas ninguém pediu nada ainda — nada a pagar.
  if ((session.orders?.length ?? 0) === 0) {
    return {
      label: 'Aberta',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    }
  }
  return {
    label: 'Aguardando pagamento',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  }
}

function TableCard({
  table,
  onClick,
}: {
  table: TableWithComanda
  onClick: () => void
}) {
  const status = deriveStatus(table)
  const session = table.sessions?.[0]
  const orderCount = session?.orders?.length ?? 0
  const total = useMemo(() => {
    if (!session) return 0
    return (session.orders ?? []).reduce(
      (acc, o) => acc + (o.items ?? []).reduce((s, i) => s + i.totalPrice, 0),
      0
    )
  }, [session])
  const deviceNames = Array.from(
    new Set(
      (session?.orders ?? [])
        .map((o) => o.deviceName)
        .filter((n): n is string => !!n && n.trim().length > 0)
    )
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 ${status.border} ${status.bg} p-4 flex flex-col gap-2 transition-all hover:shadow-md w-56 flex-shrink-0 snap-start ${
        status.pulse ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">Mesa {table.number}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/70 ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      {session ? (
        <div className="text-xs text-gray-700 space-y-1">
          <p>
            {orderCount} pedido(s) · {formatCurrency(total)}
          </p>
          <p className="text-gray-500">{timeAgo(session.openedAt)}</p>
          {deviceNames.length > 0 && (
            <p className="text-[11px] text-gray-600 truncate">{deviceNames.join(', ')}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Sem sessão aberta</p>
      )}
    </button>
  )
}

export function MesasPanel() {
  const { data: tables, isLoading, isError } = useTables()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const storeId = useAuthStore((s) => s.user?.storeId ?? null)
  const socket = useSocket(storeId)
  const qc = useQueryClient()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [scrollState, setScrollState] = useState<{ canLeft: boolean; canRight: boolean }>({
    canLeft: false,
    canRight: false,
  })

  // Beep + toast quando chega pedido novo de mesa.
  // Invalida ['tables'] (atualiza cards) e ['comanda'] (atualiza kanban do
  // drawer aberto — sem tableId, invalida todas as comandas em cache).
  useEffect(() => {
    if (!socket) return
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['tables'] })
      qc.invalidateQueries({ queryKey: ['comanda'] })
    }
    const onNew = (payload: { type?: string; tableNumber?: number }) => {
      refresh()
      if (payload.type === 'TABLE') {
        playBeep()
        toast.info(`Mesa ${payload.tableNumber ?? '?'}: novo pedido`)
      }
    }
    const onCheckRequested = (payload: { tableNumber?: number }) => {
      refresh()
      playBeep()
      toast.info(`Mesa ${payload.tableNumber ?? '?'}: cliente pediu a conta`)
    }
    socket.on('order:new', onNew)
    socket.on('order:status', refresh)
    socket.on('item:status', refresh)
    socket.on('table:check_requested', onCheckRequested)
    return () => {
      socket.off('order:new', onNew)
      socket.off('order:status', refresh)
      socket.off('item:status', refresh)
      socket.off('table:check_requested', onCheckRequested)
    }
  }, [socket, qc])

  // Re-render dos timers (timeAgo) sem refetchar o backend.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Atualiza estado das setas (esconde quando não há overflow ou já está no fim).
  // Roda ao montar, ao trocar a lista de mesas, e a cada scroll do container.
  function updateScrollState() {
    const el = scrollerRef.current
    if (!el) return
    const canLeft = el.scrollLeft > 4
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setScrollState((prev) =>
      prev.canLeft === canLeft && prev.canRight === canRight ? prev : { canLeft, canRight }
    )
  }
  useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [tables])

  function scrollBy(direction: 'left' | 'right') {
    const el = scrollerRef.current
    if (!el) return
    const delta = el.clientWidth * 0.8 * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Carregando mesas...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-red-600">
        Erro ao carregar mesas.
      </div>
    )
  }

  const list = tables ?? []
  if (list.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-2">
        <p className="text-sm text-gray-500">Nenhuma mesa cadastrada.</p>
        <p className="text-xs text-gray-400">
          Vá para a aba <span className="font-medium">QR Codes</span> e defina quantas mesas a loja atende.
        </p>
      </div>
    )
  }

  const selectedTable = list.find((t) => t.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 relative">
        {scrollState.canLeft && (
          <button
            type="button"
            aria-label="Mesas anteriores"
            onClick={() => scrollBy('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-shadow"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {scrollState.canRight && (
          <button
            type="button"
            aria-label="Próximas mesas"
            onClick={() => scrollBy('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-lg transition-shadow"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1"
        >
          {list.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              onClick={() => setSelectedId((prev) => (prev === t.id ? null : t.id))}
            />
          ))}
        </div>
      </div>

      {selectedTable && (
        <MesaDetailDrawer
          table={selectedTable}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
