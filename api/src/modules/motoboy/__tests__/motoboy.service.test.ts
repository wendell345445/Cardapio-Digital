// ─── TASK-083: Painel do Motoboy — Unit Tests ─────────────────────────────────
// Cobre: listMotoboyOrders, markDelivered

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderStatus: jest.fn() },
}))

jest.mock('../../whatsapp/messages.service', () => ({
  sendStatusUpdateMessage: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import { listMotoboyOrders, markDelivered } from '../motoboy.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const ORDER_ID = 'order-1'
const MOTOBOY_ID = 'motoboy-1'
const USER_ID = 'motoboy-user-1'
const IP = '127.0.0.1'

const mockDispatchedOrder = {
  id: ORDER_ID,
  number: 10,
  storeId: STORE_ID,
  motoboyId: MOTOBOY_ID,
  status: 'DISPATCHED' as const,
  type: 'DELIVERY' as const,
  clientWhatsapp: '5548999990001',
  clientName: 'João Cliente',
  total: 50.0,
  paymentMethod: 'CASH_ON_DELIVERY',
  address: { street: 'Rua A', number: '100', neighborhood: 'Centro', city: 'Joinville', complement: null },
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'item-1',
      productName: 'Pizza Margherita',
      variationName: null,
      quantity: 1,
      totalPrice: 50.0,
      notes: null,
      additionals: [],
    },
  ],
  client: { id: 'client-1', name: 'João Cliente', whatsapp: '5548999990001' },
  store: { id: STORE_ID, name: 'Pizzaria do Zé', slug: 'pizzaria-do-ze' },
}

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
}

beforeEach(() => jest.clearAllMocks())

// ─── listMotoboyOrders ────────────────────────────────────────────────────────

describe('listMotoboyOrders', () => {
  it('retorna pedidos DISPATCHED do motoboy na aba "active"', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([mockDispatchedOrder])

    const result = await listMotoboyOrders(STORE_ID, MOTOBOY_ID, 'active')

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: STORE_ID,
          motoboyId: MOTOBOY_ID,
          status: 'DISPATCHED',
        }),
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('DISPATCHED')
  })

  it('retorna pedidos DELIVERED do dia na aba "history"', async () => {
    const deliveredOrder = { ...mockDispatchedOrder, status: 'DELIVERED' as const }
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([deliveredOrder])

    const result = await listMotoboyOrders(STORE_ID, MOTOBOY_ID, 'history')

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: STORE_ID,
          motoboyId: MOTOBOY_ID,
          status: 'DELIVERED',
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
    expect(result[0].status).toBe('DELIVERED')
  })

  it('motoboy não vê pedidos de outro motoboy (isolamento)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const result = await listMotoboyOrders(STORE_ID, 'outro-motoboy', 'active')

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ motoboyId: 'outro-motoboy' }),
      })
    )
    expect(result).toHaveLength(0)
  })

  it('motoboy não vê pedidos de outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await listMotoboyOrders('outra-loja', MOTOBOY_ID, 'active')

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 'outra-loja', motoboyId: MOTOBOY_ID }),
      })
    )
  })

  it('retorna lista vazia quando não há pedidos ativos', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const result = await listMotoboyOrders(STORE_ID, MOTOBOY_ID, 'active')

    expect(result).toHaveLength(0)
  })
})

// ─── markDelivered ────────────────────────────────────────────────────────────

describe('markDelivered', () => {
  function setupMarkMocks(orderOverrides = {}) {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...mockDispatchedOrder, ...orderOverrides })
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockDispatchedOrder, status: 'DELIVERED', deliveredAt: new Date() })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  }

  it('marca pedido como DELIVERED com sucesso', async () => {
    setupMarkMocks()

    const result = await markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID, IP)

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({ status: 'DELIVERED', deliveredAt: expect.any(Date) }),
      })
    )
    expect(result.status).toBe('DELIVERED')
  })

  it('lança 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando pedido pertence a outra loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...mockDispatchedOrder, storeId: 'outra-loja' })

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando pedido não está atribuído a este motoboy', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockDispatchedOrder,
      motoboyId: 'outro-motoboy',
    })

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('lança 422 quando pedido já está DELIVERED (não pode desmarcar)', async () => {
    setupMarkMocks({ status: 'DELIVERED' })

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('lança 422 quando pedido está CANCELLED', async () => {
    setupMarkMocks({ status: 'CANCELLED' })

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando pedido não está com status DISPATCHED', async () => {
    setupMarkMocks({ status: 'READY' })

    await expect(markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)).rejects.toMatchObject({ status: 422 })
  })

  it('emite socket.io order:status com DELIVERED', async () => {
    setupMarkMocks()

    await markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)

    expect(mockEmit.orderStatus).toHaveBeenCalledWith(STORE_ID, { orderId: ORDER_ID, status: 'DELIVERED' })
  })

  it('registra AuditLog com action order.delivered', async () => {
    setupMarkMocks()

    await markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID, IP)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'order.delivered',
          entity: 'Order',
          entityId: ORDER_ID,
          data: expect.objectContaining({ motoboyId: MOTOBOY_ID }),
          ip: IP,
        }),
      })
    )
  })

  it('envia WhatsApp ao cliente após entregar (fire-and-forget)', async () => {
    setupMarkMocks()
    const { sendStatusUpdateMessage } = await import('../../whatsapp/messages.service')

    await markDelivered(STORE_ID, ORDER_ID, MOTOBOY_ID, USER_ID)

    // WhatsApp é fire-and-forget; verificamos que foi chamado
    expect(sendStatusUpdateMessage).toHaveBeenCalledWith(
      STORE_ID,
      mockDispatchedOrder.clientWhatsapp,
      mockDispatchedOrder.number,
      'DELIVERED',
      mockStore.name
    )
  })
})
