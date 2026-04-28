// TASK-130: opt-in via mensagem WhatsApp do cliente

jest.mock('../whatsapp.queue', () => ({
  enqueueWhatsApp: jest.fn().mockResolvedValue({ id: 'job-1' }),
}))

jest.mock('../messages.service', () => ({
  renderAndEnqueueStatusMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderStatus: jest.fn(), conversationUpdated: jest.fn() },
}))

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn(), update: jest.fn() },
    conversation: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

import { tryHandleOptIn } from '../opt-in.service'
import { enqueueWhatsApp } from '../whatsapp.queue'
import { renderAndEnqueueStatusMessage } from '../messages.service'
import { emit } from '../../../shared/socket/socket'
import { prisma } from '../../../shared/prisma/prisma'

const mockFindFirst = prisma.order.findFirst as jest.Mock
const mockUpdate = prisma.order.update as jest.Mock
const mockConvFind = prisma.conversation.findUnique as jest.Mock
const mockConvUpdate = prisma.conversation.update as jest.Mock
const mockEnqueue = enqueueWhatsApp as jest.Mock
const mockRender = renderAndEnqueueStatusMessage as jest.Mock
const mockEmitOrderStatus = emit.orderStatus as jest.Mock
const mockEmitConvUpdated = emit.conversationUpdated as jest.Mock

const orderRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  number: 42,
  status: 'CONFIRMED',
  type: 'DELIVERY',
  total: 50,
  clientWhatsapp: null,
  notifyOnStatusChange: false,
  store: { id: 'store-1', name: 'Loja Teste' },
  ...overrides,
})

describe('tryHandleOptIn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: conversa não existe (caso do teste de "pedido não existe" etc).
    // Cenários que precisam de conversa específica sobrescrevem.
    mockConvFind.mockResolvedValue(null)
  })

  it('retorna false quando texto não contém #N', async () => {
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'oi tudo bem')
    expect(handled).toBe(false)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('retorna false quando pedido não existe (fora da janela ou inexistente)', async () => {
    mockFindFirst.mockResolvedValue(null)
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'quero status do pedido #999')
    expect(handled).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('adota o WhatsApp do remetente, seta flag, envia confirmação + status e emite socket', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'olá quero #42')

    expect(handled).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { clientWhatsapp: '5511900000000', notifyOnStatusChange: true },
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

  it('não atualiza quando já é o mesmo número e flag true (idempotente)', async () => {
    mockFindFirst.mockResolvedValue(orderRecord({
      clientWhatsapp: '5511900000000',
      notifyOnStatusChange: true,
    }))
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'quero acompanhar #42')

    expect(handled).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
    // Confirmação ainda é enviada — cliente pode ter perdido a primeira
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
  })

  it('atualiza quando outro número faz opt-in do mesmo pedido', async () => {
    // Cliente trocou de aparelho, ou alguém da família refez opt-in.
    // Aceitamos a sobrescrita — última pessoa a fazer opt-in vira o destinatário.
    mockFindFirst.mockResolvedValue(orderRecord({
      clientWhatsapp: '5511900000000',
      notifyOnStatusChange: true,
    }))
    const handled = await tryHandleOptIn('store-1', '5511988888888', '#42')

    expect(handled).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { clientWhatsapp: '5511988888888', notifyOnStatusChange: true },
    })
  })

  it('aceita "# 42" com espaço', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    const handled = await tryHandleOptIn('store-1', '5511900000000', 'meu pedido # 42')
    expect(handled).toBe(true)
    expect(mockFindFirst.mock.calls[0][0].where.number).toBe(42)
  })

  it('busca casa por (storeId, number) — não filtra por clientWhatsapp', async () => {
    mockFindFirst.mockResolvedValue(null)
    await tryHandleOptIn('store-1', '5511900000000', '#42')
    const where = mockFindFirst.mock.calls[0][0].where
    expect(where.storeId).toBe('store-1')
    expect(where.number).toBe(42)
    expect(where.clientWhatsapp).toBeUndefined()
  })

  it('aplica janela de 24h e filtra status abertos', async () => {
    mockFindFirst.mockResolvedValue(null)
    await tryHandleOptIn('store-1', '5511900000000', '#42')
    const where = mockFindFirst.mock.calls[0][0].where
    expect(where.createdAt?.gte).toBeInstanceOf(Date)
    expect(where.status?.in).toEqual(expect.arrayContaining(['CONFIRMED', 'PREPARING', 'READY']))
    expect(where.status?.in).not.toContain('DELIVERED')
    expect(where.status?.in).not.toContain('CANCELLED')
  })

  it('tira conversa do modo humano quando opt-in casa', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    mockConvFind.mockResolvedValue({ id: 'conv-1', isHumanMode: true })

    await tryHandleOptIn('store-1', '5511900000000', '#42')

    expect(mockConvFind).toHaveBeenCalledWith({
      where: { storeId_customerPhone: { storeId: 'store-1', customerPhone: '5511900000000' } },
      select: { id: true, isHumanMode: true },
    })
    expect(mockConvUpdate).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { isHumanMode: false },
    })
    expect(mockEmitConvUpdated).toHaveBeenCalledWith('store-1', {
      conversationId: 'conv-1',
      isHumanMode: false,
    })
  })

  it('NÃO mexe na conversa quando ela já está em modo IA', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    mockConvFind.mockResolvedValue({ id: 'conv-1', isHumanMode: false })

    await tryHandleOptIn('store-1', '5511900000000', '#42')

    expect(mockConvUpdate).not.toHaveBeenCalled()
    expect(mockEmitConvUpdated).not.toHaveBeenCalled()
  })

  it('não quebra quando conversa não existe (cliente novo)', async () => {
    mockFindFirst.mockResolvedValue(orderRecord())
    mockConvFind.mockResolvedValue(null)

    const handled = await tryHandleOptIn('store-1', '5511900000000', '#42')

    expect(handled).toBe(true)
    expect(mockConvUpdate).not.toHaveBeenCalled()
  })
})
