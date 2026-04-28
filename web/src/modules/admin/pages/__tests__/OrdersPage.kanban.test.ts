// ─── A-051: [Pedidos - Kanban] Coluna "Confirmado" ───────────────────────────
// Valida que pedidos com status CONFIRMED são agrupados na coluna "Confirmado"
// do Kanban, e que pedidos em outros statuses NÃO aparecem nesta coluna.

import { describe, it, expect } from 'vitest'

import type { Order } from '../../services/orders.service'

// ─── Reprodução da config do Kanban (fonte: OrdersPage.tsx) ─────────────────

const ACTIVE_COLUMN_CONFIG = [
  { id: 'novos', label: 'Novos', statuses: ['WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION'] },
  { id: 'confirmado', label: 'Confirmado', statuses: ['CONFIRMED'] },
  { id: 'em_preparo', label: 'Em preparo', statuses: ['PREPARING'] },
  { id: 'prontos', label: 'Prontos / saída', statuses: ['READY', 'DISPATCHED'] },
  { id: 'concluidos', label: 'Concluídos', statuses: ['DELIVERED'] },
]

// Mesma lógica de agrupamento do OrdersPage (linhas 422-426)
function groupByColumn(orders: Order[]): Record<string, Order[]> {
  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED')
  const byColumn: Record<string, Order[]> = {}
  for (const col of ACTIVE_COLUMN_CONFIG) {
    byColumn[col.id] = activeOrders.filter((o) => col.statuses.includes(o.status))
  }
  return byColumn
}

// ─── Factory ────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    number: 42,
    status: 'CONFIRMED',
    type: 'DELIVERY',
    paymentMethod: 'PIX',
    clientWhatsapp: '5548999990001',
    clientName: 'João',
    subtotal: 50,
    deliveryFee: 5,
    discount: 0,
    total: 55,
    items: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('A-051: [Pedidos - Kanban] Coluna "Confirmado"', () => {
  describe('Configuração do Kanban', () => {
    it('coluna "confirmado" existe com status CONFIRMED', () => {
      const col = ACTIVE_COLUMN_CONFIG.find((c) => c.id === 'confirmado')
      expect(col).toBeDefined()
      expect(col!.statuses).toEqual(['CONFIRMED'])
      expect(col!.label).toBe('Confirmado')
    })

    it('status CONFIRMED não pertence a nenhuma outra coluna', () => {
      const otherCols = ACTIVE_COLUMN_CONFIG.filter((c) => c.id !== 'confirmado')
      for (const col of otherCols) {
        expect(col.statuses).not.toContain('CONFIRMED')
      }
    })

    it('coluna "confirmado" é a segunda coluna (após "Novos")', () => {
      expect(ACTIVE_COLUMN_CONFIG[0].id).toBe('novos')
      expect(ACTIVE_COLUMN_CONFIG[1].id).toBe('confirmado')
    })
  })

  describe('Agrupamento de pedidos', () => {
    it('pedido CONFIRMED aparece na coluna "confirmado"', () => {
      const orders = [makeOrder({ status: 'CONFIRMED' })]
      const grouped = groupByColumn(orders)

      expect(grouped['confirmado']).toHaveLength(1)
      expect(grouped['confirmado'][0].status).toBe('CONFIRMED')
    })

    it('pedido CONFIRMED NÃO aparece na coluna "novos"', () => {
      const orders = [makeOrder({ status: 'CONFIRMED' })]
      const grouped = groupByColumn(orders)

      expect(grouped['novos']).toHaveLength(0)
    })

    it('pedido CONFIRMED NÃO aparece em nenhuma outra coluna ativa', () => {
      const orders = [makeOrder({ status: 'CONFIRMED' })]
      const grouped = groupByColumn(orders)

      expect(grouped['em_preparo']).toHaveLength(0)
      expect(grouped['prontos']).toHaveLength(0)
      expect(grouped['concluidos']).toHaveLength(0)
    })

    it('pedidos em "Novos" (WAITING_PAYMENT_PROOF, WAITING_CONFIRMATION) não aparecem em "confirmado"', () => {
      const orders = [
        makeOrder({ id: 'a', status: 'WAITING_PAYMENT_PROOF' }),
        makeOrder({ id: 'b', status: 'WAITING_CONFIRMATION' }),
      ]
      const grouped = groupByColumn(orders)

      expect(grouped['confirmado']).toHaveLength(0)
      expect(grouped['novos']).toHaveLength(2)
    })

    it('pedido com status PENDING (descontinuado) não aparece em nenhuma coluna do Kanban', () => {
      const orders = [makeOrder({ id: 'a', status: 'PENDING' })]
      const grouped = groupByColumn(orders)

      for (const col of ACTIVE_COLUMN_CONFIG) {
        expect(grouped[col.id]).toHaveLength(0)
      }
    })
  })

  describe('Fluxo de pagamento confirmado → coluna Confirmado', () => {
    it('pedido Pix (WAITING_PAYMENT_PROOF → CONFIRMED): sai de "novos" e entra em "confirmado"', () => {
      // Estado ANTES da confirmação
      const before = [makeOrder({ status: 'WAITING_PAYMENT_PROOF', paymentMethod: 'PIX' })]
      const groupedBefore = groupByColumn(before)
      expect(groupedBefore['novos']).toHaveLength(1)
      expect(groupedBefore['confirmado']).toHaveLength(0)

      // Estado DEPOIS da confirmação
      const after = [makeOrder({ status: 'CONFIRMED', paymentMethod: 'PIX', confirmedAt: new Date().toISOString() })]
      const groupedAfter = groupByColumn(after)
      expect(groupedAfter['novos']).toHaveLength(0)
      expect(groupedAfter['confirmado']).toHaveLength(1)
    })

    it('pedido dinheiro (WAITING_CONFIRMATION → CONFIRMED): sai de "novos" e entra em "confirmado"', () => {
      const before = [makeOrder({ status: 'WAITING_CONFIRMATION', paymentMethod: 'CASH_ON_DELIVERY' })]
      const groupedBefore = groupByColumn(before)
      expect(groupedBefore['novos']).toHaveLength(1)
      expect(groupedBefore['confirmado']).toHaveLength(0)

      const after = [makeOrder({ status: 'CONFIRMED', paymentMethod: 'CASH_ON_DELIVERY', confirmedAt: new Date().toISOString() })]
      const groupedAfter = groupByColumn(after)
      expect(groupedAfter['novos']).toHaveLength(0)
      expect(groupedAfter['confirmado']).toHaveLength(1)
    })

  })

  describe('Cenários com múltiplos pedidos', () => {
    it('kanban distribui pedidos corretamente entre todas as colunas', () => {
      const orders = [
        makeOrder({ id: '1', status: 'WAITING_PAYMENT_PROOF' }),
        makeOrder({ id: '2', status: 'WAITING_CONFIRMATION' }),
        makeOrder({ id: '3', status: 'CONFIRMED' }),
        makeOrder({ id: '4', status: 'CONFIRMED' }),
        makeOrder({ id: '5', status: 'PREPARING' }),
        makeOrder({ id: '6', status: 'READY' }),
        makeOrder({ id: '7', status: 'DISPATCHED' }),
        makeOrder({ id: '8', status: 'DELIVERED' }),
        makeOrder({ id: '9', status: 'CANCELLED' }),
      ]
      const grouped = groupByColumn(orders)

      expect(grouped['novos']).toHaveLength(2) // WAITING_PAYMENT_PROOF + WAITING_CONFIRMATION
      expect(grouped['confirmado']).toHaveLength(2)
      expect(grouped['em_preparo']).toHaveLength(1)
      expect(grouped['prontos']).toHaveLength(2) // READY + DISPATCHED
      expect(grouped['concluidos']).toHaveLength(1)
      // CANCELLED não aparece em nenhuma coluna ativa
    })

    it('pedidos cancelados NÃO aparecem na coluna "confirmado" nem em outra coluna ativa', () => {
      const orders = [makeOrder({ status: 'CANCELLED' })]
      const grouped = groupByColumn(orders)

      for (const col of ACTIVE_COLUMN_CONFIG) {
        expect(grouped[col.id]).toHaveLength(0)
      }
    })
  })
})
