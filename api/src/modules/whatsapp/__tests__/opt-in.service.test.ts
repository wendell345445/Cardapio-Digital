// TASK-130: opt-in via mensagem WhatsApp do cliente

jest.mock('../whatsapp.queue', () => ({
  enqueueWhatsApp: jest.fn().mockResolvedValue({ id: 'job-1' }),
}))

jest.mock('../messages.service', () => ({
  renderAndEnqueueStatusMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderStatus: jest.fn() },
}))

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn(), update: jest.fn() },
  },
}))

import { tryHandleOptIn } from '../opt-in.service'
import { enqueueWhatsApp } from '../whatsapp.queue'
import { renderAndEnqueueStatusMessage } from '../messages.service'
import { emit } from '../../../shared/socket/socket'
import { prisma } from '../../../shared/prisma/prisma'

const mockFindFirst = prisma.order.findFirst as jest.Mock
const mockUpdate = prisma.order.update as jest.Mock
const mockEnqueue = enqueueWhatsApp as jest.Mock
const mockRender = renderAndEnqueueStatusMessage as jest.Mock
const mockEmitOrderStatus = emit.orderStatus as jest.Mock

const orderRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  number: 42,
  status: 'CONFIRMED',
  type: 'DELIVERY',
  total: 50,
  notifyOnStatusChange: false,
  store: { id: 'store-1', name: 'Loja Teste' },
  ...overrides,
})

describe('tryHandleOptIn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna false quando texto não contém #N', async () => {
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'oi tudo bem')
    expect(handled).toBe(false)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('retorna false quando pedido não existe', async () => {
    mockFindFirst.mockResolvedValue(null)
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'quero status do pedido #999')
    expect(handled).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('seta flag, envia confirmação + status atual e emite socket', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'olá quero #42')

    expect(handled).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { notifyOnStatusChange: true },
    })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    expect(mockEnqueue.mock.calls[0][0].text).toContain('#42')
    expect(mockEnqueue.mock.calls[0][0].text).toContain('Confirmado')
    expect(mockRender).toHaveBeenCalledWith(
      'store-1', '5511900000000', 42, 'CONFIRMED', 'Loja Teste', 'DELIVERY',
      { total: 50 }
    )
    expect(mockEmitOrderStatus).toHaveBeenCalledWith('store-1', { orderId: 'order-1', status: 'CONFIRMED' })
  })

  it('não duplica update quando flag já é true (idempotente)', async () => {
    mockFindFirst.mockResolvedValue(orderRecord({ notifyOnStatusChange: true }))
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'quero acompanhar #42')

    expect(handled).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
    // Confirmação ainda é enviada — cliente pode ter perdido a primeira
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
  })

  it('aceita "# 42" com espaço', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'meu pedido # 42')
    expect(handled).toBe(true)
    expect(mockFindFirst.mock.calls[0][0].where.number).toBe(42)
  })

  it('só casa pedido com clientWhatsapp do remetente', async () => {
    mockFindFirst.mockResolvedValue(null)
    await tryHandleOptIn('store-1', '5511900000000', '#42')
    expect(mockFindFirst.mock.calls[0][0].where.clientWhatsapp).toBe('5511900000000')
  })
})
