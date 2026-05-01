import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { isAxiosError } from 'axios'
import { Banknote, CheckCircle2, ChefHat, Clock, CreditCard, QrCode, Smartphone, X } from 'lucide-react'

import {
  useCloseTable,
  useComanda,
  useSettleTable,
  useUpdateItemStatus,
} from '../../hooks/useTables'
import type {
  ComandaItem,
  TablePaymentMethod,
  TableWithComanda,
} from '../../services/tables.service'

import { toast } from '@/shared/lib/toast'

type ItemStatus = 'PENDING' | 'PREPARING' | 'DELIVERED'

interface Props {
  table: TableWithComanda
  onClose: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function DraggableItem({ item }: { item: ComandaItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { fromStatus: item.status },
  })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 50 : 'auto' }
    : undefined

  const StatusIcon =
    item.status === 'PENDING' ? Clock : item.status === 'PREPARING' ? ChefHat : CheckCircle2

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900">
            {item.quantity}x {item.productName}
            {item.variationName && (
              <span className="text-gray-500 font-normal"> — {item.variationName}</span>
            )}
          </p>
          {item.deviceName && (
            <p className="text-xs text-blue-600 mt-0.5 font-medium">por {item.deviceName}</p>
          )}
          {item.notes && <p className="text-xs text-gray-500 mt-0.5">Obs: {item.notes}</p>}
          {item.additionals.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              + {item.additionals.map((a) => a.name).join(', ')}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-1 font-medium">{formatCurrency(item.totalPrice)}</p>
        </div>
        <StatusIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      </div>
    </div>
  )
}

function DropColumn({
  status,
  title,
  count,
  scrollable,
  children,
}: {
  status: ItemStatus
  title: string
  count: number
  // Quando qualquer coluna passa de 5 itens, todas viram scrollable (alturas
  // iguais entre as 3). Cap em ~5 cards visíveis (450px).
  scrollable: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border-2 border-dashed p-3 min-h-[200px] transition-colors ${
        isOver ? 'border-red-400 bg-red-50/50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">{count}</span>
      </header>
      <div className={`flex flex-col gap-2 ${scrollable ? 'max-h-[450px] overflow-y-auto pr-1' : ''}`}>
        {children}
      </div>
    </div>
  )
}

// v2.7: passou de drawer overlay para painel inline (renderizado abaixo da
// faixa horizontal de mesas). Mantém o nome do componente e a mesma API
// (`onClose` agora desseleciona a mesa em vez de fechar overlay).
export function MesaDetailDrawer({ table, onClose }: Props) {
  const { data: comanda, isLoading, isError } = useComanda(table.id)
  const updateStatus = useUpdateItemStatus()
  const closeTableMutation = useCloseTable()
  const settleTableMutation = useSettleTable()

  // Painel "Fechar conta" — taxa de serviço + escolha do método numa só tela.
  // Para sessão JÁ paga (caso raro: alguém usou o /payment antigo), entra no
  // fluxo simplificado de close (sem método de pagamento, só taxa).
  const [settleOpen, setSettleOpen] = useState(false)
  const [closePaidOpen, setClosePaidOpen] = useState(false)
  const [applyServiceCharge, setApplyServiceCharge] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState(10)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const items = comanda?.items ?? []
  const pendingItems = items.filter((i) => i.status === 'PENDING')
  const preparingItems = items.filter((i) => i.status === 'PREPARING')
  const deliveredItems = items.filter((i) => i.status === 'DELIVERED')
  // Se qualquer coluna passa de 5, todas viram scrollable pra manter alturas iguais.
  const columnsScrollable =
    pendingItems.length > 5 || preparingItems.length > 5 || deliveredItems.length > 5
  const isPaid = comanda?.session?.isPaid ?? false
  const subtotal = comanda?.subtotal ?? 0

  const serviceChargeAmount =
    applyServiceCharge ? (subtotal * serviceChargePercent) / 100 : 0
  const finalTotal = subtotal + serviceChargeAmount

  function handleDragEnd(event: DragEndEvent) {
    const itemId = event.active.id as string
    const target = event.over?.id as ItemStatus | undefined
    const fromStatus = event.active.data.current?.fromStatus as ItemStatus | undefined
    if (!target || target === fromStatus) return
    updateStatus.mutate(
      { tableId: table.id, itemId, status: target },
      {
        onError: (err) => {
          const msg = isAxiosError(err)
            ? err.response?.data?.error ?? 'Erro ao atualizar status'
            : 'Erro ao atualizar status'
          toast.error(msg)
        },
      }
    )
  }

  function handleSettle(method: TablePaymentMethod) {
    settleTableMutation.mutate(
      {
        tableId: table.id,
        dto: {
          paymentMethod: method,
          applyServiceCharge,
          serviceChargePercent: applyServiceCharge ? serviceChargePercent : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Mesa ${table.number} fechada · ${methodLabel(method)}`)
          onClose()
        },
        onError: (err) => {
          const msg = isAxiosError(err)
            ? err.response?.data?.error ?? 'Erro ao fechar conta'
            : 'Erro ao fechar conta'
          toast.error(msg)
        },
      }
    )
  }

  function handleCloseTable() {
    closeTableMutation.mutate(
      {
        id: table.id,
        dto: {
          applyServiceCharge,
          serviceChargePercent: applyServiceCharge ? serviceChargePercent : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Mesa ${table.number} fechada`)
          onClose()
        },
        onError: (err) => {
          const msg = isAxiosError(err)
            ? err.response?.data?.error ?? 'Erro ao fechar mesa'
            : 'Erro ao fechar mesa'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Mesa {table.number}</h2>
          {comanda?.session && (
            <p className="text-xs text-gray-500">
              Sessão aberta · {new Date(comanda.session.openedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {isPaid && comanda.session.paymentMethod && (
                <span className="ml-2 text-blue-600 font-medium">
                  · Paga via {methodLabel(comanda.session.paymentMethod)}
                </span>
              )}
              {comanda.session.checkRequestedAt && !isPaid && (
                <span className="ml-2 text-purple-700 font-semibold">
                  · Cliente pediu a conta às {new Date(comanda.session.checkRequestedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="px-6 py-4">
        {isLoading && <p className="text-center text-sm text-gray-500 py-8">Carregando comanda...</p>}
        {isError && <p className="text-center text-sm text-red-600 py-8">Erro ao carregar comanda.</p>}

        {comanda && !comanda.session && (
          <p className="text-center text-sm text-gray-500 py-12">
            Nenhuma sessão aberta para esta mesa.
          </p>
        )}

        {comanda?.session && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DropColumn status="PENDING" title="Pendentes" count={pendingItems.length} scrollable={columnsScrollable}>
                {pendingItems.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-1">Nada pendente.</p>
                ) : (
                  pendingItems.map((item) => <DraggableItem key={item.id} item={item} />)
                )}
              </DropColumn>
              <DropColumn status="PREPARING" title="Em preparo" count={preparingItems.length} scrollable={columnsScrollable}>
                {preparingItems.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-1">Nada em preparo.</p>
                ) : (
                  preparingItems.map((item) => <DraggableItem key={item.id} item={item} />)
                )}
              </DropColumn>
              <DropColumn status="DELIVERED" title="Entregues" count={deliveredItems.length} scrollable={columnsScrollable}>
                {deliveredItems.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-1">Nada entregue.</p>
                ) : (
                  deliveredItems.map((item) => <DraggableItem key={item.id} item={item} />)
                )}
              </DropColumn>
            </div>
          </DndContext>
        )}
      </div>

      {comanda?.session && (
        <footer className="border-t border-gray-200 px-6 py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>

          {items.length === 0 ? (
            // Mesa aberta sem pedido — não há o que cobrar. Libera direto.
            <button
              type="button"
              onClick={handleCloseTable}
              disabled={closeTableMutation.isPending}
              className="w-full rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold transition-colors"
            >
              {closeTableMutation.isPending ? 'Encerrando...' : 'Encerrar mesa'}
            </button>
          ) : isPaid ? (
            // Sessão já paga via /payment antigo (compat). Fluxo só de close +
            // taxa de serviço, sem reescolher método.
            !closePaidOpen ? (
              <button
                type="button"
                onClick={() => setClosePaidOpen(true)}
                className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-semibold transition-colors"
              >
                Fechar sessão
              </button>
            ) : (
              <ServiceChargePanel
                applyServiceCharge={applyServiceCharge}
                onToggleServiceCharge={setApplyServiceCharge}
                serviceChargePercent={serviceChargePercent}
                onChangeServiceChargePercent={setServiceChargePercent}
                subtotal={subtotal}
                serviceChargeAmount={serviceChargeAmount}
                total={finalTotal}
                onCancel={() => setClosePaidOpen(false)}
                actions={
                  <button
                    type="button"
                    onClick={handleCloseTable}
                    disabled={closeTableMutation.isPending}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {closeTableMutation.isPending ? 'Fechando...' : 'Confirmar'}
                  </button>
                }
              />
            )
          ) : !settleOpen ? (
            <button
              type="button"
              onClick={() => setSettleOpen(true)}
              className="w-full rounded-lg bg-green-600 hover:bg-green-700 text-white py-2.5 text-sm font-semibold transition-colors"
            >
              Fechar conta
            </button>
          ) : (
            <ServiceChargePanel
              title="Fechar conta"
              applyServiceCharge={applyServiceCharge}
              onToggleServiceCharge={setApplyServiceCharge}
              serviceChargePercent={serviceChargePercent}
              onChangeServiceChargePercent={setServiceChargePercent}
              subtotal={subtotal}
              serviceChargeAmount={serviceChargeAmount}
              total={finalTotal}
              onCancel={() => setSettleOpen(false)}
              actions={
                <PaymentMethodButtons
                  disabled={settleTableMutation.isPending}
                  onSelect={handleSettle}
                />
              }
            />
          )}
        </footer>
      )}
    </section>
  )
}

interface ServiceChargePanelProps {
  title?: string
  applyServiceCharge: boolean
  onToggleServiceCharge: (v: boolean) => void
  serviceChargePercent: number
  onChangeServiceChargePercent: (n: number) => void
  subtotal: number
  serviceChargeAmount: number
  total: number
  onCancel: () => void
  actions: React.ReactNode
}

function ServiceChargePanel({
  title = 'Confirmar fechamento',
  applyServiceCharge,
  onToggleServiceCharge,
  serviceChargePercent,
  onChangeServiceChargePercent,
  subtotal,
  serviceChargeAmount,
  total,
  onCancel,
  actions,
}: ServiceChargePanelProps) {
  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-4 border border-gray-200">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={applyServiceCharge}
          onChange={(e) => onToggleServiceCharge(e.target.checked)}
          className="rounded"
        />
        Adicionar taxa de serviço
      </label>
      {applyServiceCharge && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={serviceChargePercent}
            onChange={(e) => onChangeServiceChargePercent(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <span className="text-sm text-gray-600">%</span>
          <span className="text-sm text-gray-600">= {formatCurrency(serviceChargeAmount)}</span>
        </div>
      )}
      <div className="space-y-1 border-t border-gray-200 pt-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {applyServiceCharge && serviceChargeAmount > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Taxa de serviço</span>
            <span>{formatCurrency(serviceChargeAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </button>
        {actions}
      </div>
    </div>
  )
}

const PAYMENT_OPTIONS: Array<{
  value: TablePaymentMethod
  label: string
  icon: React.ElementType
  color: string
}> = [
  { value: 'PIX', label: 'PIX', icon: QrCode, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { value: 'CASH', label: 'Dinheiro', icon: Banknote, color: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'CREDIT', label: 'Crédito', icon: CreditCard, color: 'bg-blue-500 hover:bg-blue-600' },
  { value: 'DEBIT', label: 'Débito', icon: Smartphone, color: 'bg-indigo-500 hover:bg-indigo-600' },
]

interface PaymentMethodButtonsProps {
  disabled: boolean
  onSelect: (method: TablePaymentMethod) => void
}

function PaymentMethodButtons({ disabled, onSelect }: PaymentMethodButtonsProps) {
  return (
    <div className="flex-[2] grid grid-cols-2 gap-2">
      {PAYMENT_OPTIONS.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            className={`${opt.color} disabled:opacity-50 text-white rounded-lg py-2 px-3 flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors`}
          >
            <Icon className="w-4 h-4" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function methodLabel(method: TablePaymentMethod): string {
  switch (method) {
    case 'PIX': return 'PIX'
    case 'CASH': return 'Dinheiro'
    case 'CREDIT': return 'Crédito'
    case 'DEBIT': return 'Débito'
  }
}
