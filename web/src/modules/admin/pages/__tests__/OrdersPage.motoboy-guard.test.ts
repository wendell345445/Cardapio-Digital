// Regressão: arrastar pedido READY (DELIVERY) sem motoboy atribuído direto
// para "Concluídos" pulava o fluxo esperado sem aviso, perdendo o histórico
// de quem fez a entrega.

import { describe, it, expect } from 'vitest'

import type { Order } from '../../services/orders.service'
import { requiresMotoboyConfirmation } from '../OrdersPage'

function makeOrder(overrides: Partial<Order> = {}): Pick<Order, 'status' | 'type' | 'motoboyId'> {
  return {
    status: 'READY',
    type: 'DELIVERY',
    motoboyId: null,
    ...overrides,
  }
}

describe('requiresMotoboyConfirmation', () => {
  it('READY + DELIVERY + sem motoboy → DELIVERED: exige confirmação', () => {
    expect(requiresMotoboyConfirmation(makeOrder(), 'DELIVERED')).toBe(true)
  })

  it('READY + DELIVERY + com motoboy → DELIVERED: não exige', () => {
    expect(requiresMotoboyConfirmation(makeOrder({ motoboyId: 'moto-1' }), 'DELIVERED')).toBe(false)
  })

  it('READY + PICKUP → DELIVERED: não exige (retirada não tem motoboy)', () => {
    expect(requiresMotoboyConfirmation(makeOrder({ type: 'PICKUP' }), 'DELIVERED')).toBe(false)
  })

  it('READY + TABLE → DELIVERED: não exige', () => {
    expect(requiresMotoboyConfirmation(makeOrder({ type: 'TABLE' }), 'DELIVERED')).toBe(false)
  })

  it('DISPATCHED + sem motoboy → DELIVERED: não exige (já passou pela etapa Pronto)', () => {
    expect(requiresMotoboyConfirmation(makeOrder({ status: 'DISPATCHED' }), 'DELIVERED')).toBe(false)
  })

  it('READY + DELIVERY → DISPATCHED: não exige (só pede confirmação ao pular pra concluído)', () => {
    expect(requiresMotoboyConfirmation(makeOrder(), 'DISPATCHED')).toBe(false)
  })

  it('READY + DELIVERY + motoboyId undefined: exige (trata como sem motoboy)', () => {
    expect(requiresMotoboyConfirmation(makeOrder({ motoboyId: undefined }), 'DELIVERED')).toBe(true)
  })
})
