// ─── Kanban v2.9: "Novos" agrupa WAITING_* + CONFIRMED; "Em preparo" só PREPARING
// Auto-confirm faz o pedido nascer em CONFIRMED, mas ele continua em "Novos" até
// o operador clicar "→" ou arrastar pra "Em preparo".

import { describe, it, expect } from 'vitest'

import type { Order } from '../../services/orders.service'

// ─── Reprodução da config do Kanban (fonte: OrdersPage.tsx) ─────────────────

const ACTIVE_COLUMN_CONFIG = [
  { id: 'novos', label: 'Novos', statuses: ['WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION', 'CONFIRMED'] },
  { id: 'em_preparo', label: 'Em preparo', statuses: ['PREPARING'] },
  { id: 'saiu_entrega', label: 'Saiu pra entrega', statuses: ['READY', 'DISPATCHED'] },
  { id: 'concluidos', label: 'Concluídos', statuses: ['DELIVERED'] },
]

function groupByColumn(orders: Order[]): Record<string, Order[]> {
  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED')
  const byColumn: Record<string, Order[]> = {}
  for (const col of ACTIVE_COLUMN_CONFIG) {
    byColumn[col.id] = activeOrders.filter((o) => col.statuses.includes(o.status))
  }
  return byColumn
}

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

describe('Kanban v2.9 — "Novos" agrupa WAITING_* + CONFIRMED', () => {
  describe('Configuração do Kanban', () => {
    it('coluna "novos" inclui WAITING_PAYMENT_PROOF, WAITING_CONFIRMATION e CONFIRMED', () => {
      const col = ACTIVE_COLUMN_CONFIG.find((c) => c.id === 'novos')
      expect(col).toBeDefined()
      expect(col!.statuses).toEqual(['WAITING_PAYMENT_PROOF', 'WAITING_CONFIRMATION', 'CONFIRMED'])
    })

    it('coluna "em_preparo" contém SÓ PREPARING (CONFIRMED foi pra Novos)', () => {
      const col = ACTIVE_COLUMN_CONFIG.find((c) => c.id === 'em_preparo')
      expect(col).toBeDefined()
      expect(col!.statuses).toEqual(['PREPARING'])
    })

    it('CONFIRMED não pertence a nenhuma outra coluna além de "novos"', () => {
      const otherCols = ACTIVE_COLUMN_CONFIG.filter((c) => c.id !== 'novos')
      for (const col of otherCols) {
        expect(col.statuses).not.toContain('CONFIRMED')
      }
    })
  })

  describe('Agrupamento — auto-confirm ON: pedido nasce em CONFIRMED mas fica em "Novos"', () => {
    it('pedido CONFIRMED aparece na coluna "novos"', () => {
      const orders = [makeOrder({ status: 'CONFIRMED' })]
      const grouped = groupByColumn(orders)

      expect(grouped['novos']).toHaveLength(1)
      expect(grouped['novos'][0].status).toBe('CONFIRMED')
    })

    it('pedido CONFIRMED NÃO aparece na coluna "em_preparo"', () => {
      const orders = [makeOrder({ status: 'CONFIRMED' })]
      const grouped = groupByColumn(orders)

      expect(grouped['em_preparo']).toHaveLength(0)
    })

    it('só status PREPARING aparece em "Em preparo"', () => {
      const orders = [makeOrder({ status: 'PREPARING' })]
      const grouped = groupByColumn(orders)

      expect(grouped['em_preparo']).toHaveLength(1)
      expect(grouped['novos']).toHaveLength(0)
    })
  })

  describe('Fluxo de transição: Novos → Em preparo', () => {
    it('pedido auto-confirmado (CONFIRMED) está em "Novos" antes de avançar', () => {
      const before = [makeOrder({ status: 'CONFIRMED', confirmedAt: new Date().toISOString() })]
      const groupedBefore = groupByColumn(before)
      expect(groupedBefore['novos']).toHaveLength(1)
      expect(groupedBefore['em_preparo']).toHaveLength(0)
    })

    it('depois de avançar (CONFIRMED → PREPARING): sai de "Novos" e entra em "Em preparo"', () => {
      const after = [makeOrder({ status: 'PREPARING', confirmedAt: new Date().toISOString() })]
      const groupedAfter = groupByColumn(after)
      expect(groupedAfter['novos']).toHaveLength(0)
      expect(groupedAfter['em_preparo']).toHaveLength(1)
    })

    it('fluxo manual: WAITING_CONFIRMATION → CONFIRMED → PREPARING, ambos os primeiros em "Novos"', () => {
      // Estado 1: aguardando confirmação
      let grouped = groupByColumn([makeOrder({ status: 'WAITING_CONFIRMATION' })])
      expect(grouped['novos']).toHaveLength(1)

      // Estado 2: confirmado manualmente — ainda em Novos, aguardando "→"
      grouped = groupByColumn([makeOrder({ status: 'CONFIRMED' })])
      expect(grouped['novos']).toHaveLength(1)

      // Estado 3: em preparo — finalmente saiu de Novos
      grouped = groupByColumn([makeOrder({ status: 'PREPARING' })])
      expect(grouped['novos']).toHaveLength(0)
      expect(grouped['em_preparo']).toHaveLength(1)
    })
  })

  describe('Cenários com múltiplos pedidos', () => {
    it('kanban distribui corretamente — Novos junta WAITING_* + CONFIRMED', () => {
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

      expect(grouped['novos']).toHaveLength(4) // WAITING_PAYMENT_PROOF + WAITING_CONFIRMATION + 2 CONFIRMED
      expect(grouped['em_preparo']).toHaveLength(1) // só PREPARING
      expect(grouped['saiu_entrega']).toHaveLength(2) // READY + DISPATCHED
      expect(grouped['concluidos']).toHaveLength(1)
      // CANCELLED não aparece em nenhuma coluna ativa
    })

    it('pedidos cancelados NÃO aparecem em nenhuma coluna ativa', () => {
      const orders = [makeOrder({ status: 'CANCELLED' })]
      const grouped = groupByColumn(orders)

      for (const col of ACTIVE_COLUMN_CONFIG) {
        expect(grouped[col.id]).toHaveLength(0)
      }
    })
  })
})
