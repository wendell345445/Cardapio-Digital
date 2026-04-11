// ─── Epic 06: Gestão de Pedidos — Admin Orders Service Unit Tests ─────────────
// Cobre: listOrders, getOrder, updateOrderStatus, assignMotoboy

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderStatus: jest.fn() },
}))

jest.mock('../../whatsapp/messages.service', () => ({
  sendStatusUpdateMessage: jest.fn().mockResolvedValue(undefined),
  sendMotoboyAssignedMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../print.service', () => ({
  autoPrintOrder: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../cashflow.service', () => ({
  linkOrderToCashFlow: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import { listOrders, getOrder, updateOrderStatus, assignMotoboy, sendWaitingPaymentNotification } from '../orders.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const ORDER_ID = 'order-1'
const USER_ID = 'admin-1'
const MOTOBOY_ID = 'motoboy-1'
const IP = '127.0.0.1'

const mockOrder = {
  id: ORDER_ID,
  number: 42,
  storeId: STORE_ID,
  status: 'WAITING_CONFIRMATION' as const,
  type: 'DELIVERY' as const,
  clientWhatsapp: '5548999990001',
  clientName: 'João Cliente',
  total: 50.0,
  subtotal: 50.0,
  deliveryFee: 0,
  discount: 0,
  paymentMethod: 'CASH_ON_DELIVERY',
  address: { street: 'Rua A', number: '100', neighborhood: 'Centro', city: 'Joinville', complement: null },
  notes: null,
  motoboyId: null,
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
  motoboy: null,
  client: { id: 'client-1', name: 'João Cliente', whatsapp: '5548999990001' },
  coupon: null,
}

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
  slug: 'pizzaria-do-ze',
  phone: '5548999990000',
}

const mockMotoboy = {
  id: MOTOBOY_ID,
  name: 'Carlos Moto',
  whatsapp: '5548999990002',
}

beforeEach(() => jest.clearAllMocks())

// ─── listOrders ───────────────────────────────────────────────────────────────

describe('listOrders', () => {
  it('retorna pedidos da loja com nextCursor null quando não há mais', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder])

    const result = await listOrders(STORE_ID, { limit: 20 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ storeId: STORE_ID }) })
    )
    expect(result.orders).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })

  it('retorna nextCursor quando há mais itens que o limite', async () => {
    const orders = Array.from({ length: 21 }, (_, i) => ({ ...mockOrder, id: `order-${i}` }))
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders)

    const result = await listOrders(STORE_ID, { limit: 20 })

    expect(result.orders).toHaveLength(20)
    expect(result.nextCursor).toBe('order-20')
  })

  it('filtra por status quando informado', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await listOrders(STORE_ID, { status: 'CONFIRMED' as any, limit: 20 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
  })

  it('filtra por paymentMethod quando informado', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await listOrders(STORE_ID, { paymentMethod: 'PIX' as any, limit: 20 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paymentMethod: 'PIX' }) })
    )
  })

  it('filtra por intervalo de datas quando dateFrom e dateTo informados', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await listOrders(STORE_ID, { dateFrom: '2024-01-01', dateTo: '2024-01-31', limit: 20 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    )
  })

  it('usa cursor-based pagination quando cursor informado', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await listOrders(STORE_ID, { cursor: 'order-10', limit: 20 })

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'order-10' }, skip: 1 })
    )
  })
})

// ─── getOrder ─────────────────────────────────────────────────────────────────

describe('getOrder', () => {
  it('retorna pedido completo quando encontrado na loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)

    const result = await getOrder(STORE_ID, ORDER_ID)

    expect(result.id).toBe(ORDER_ID)
    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID } })
    )
  })

  it('lança 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getOrder(STORE_ID, 'nao-existe')).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando pedido pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrder,
      storeId: 'outra-loja',
    })

    await expect(getOrder(STORE_ID, ORDER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateOrderStatus ────────────────────────────────────────────────────────

describe('updateOrderStatus', () => {
  function setupUpdateMocks(orderOverrides = {}) {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...mockOrder, ...orderOverrides })
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, ...orderOverrides })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  }

  it('atualiza status de WAITING_CONFIRMATION → CONFIRMED com sucesso', async () => {
    setupUpdateMocks({ status: 'WAITING_CONFIRMATION' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' })

    const result = await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID, IP)

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
    expect(result.status).toBe('CONFIRMED')
  })

  it('lança 404 quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando pedido pertence a outra loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...mockOrder, storeId: 'outra-loja' })

    await expect(
      updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 para transição de status inválida (DELIVERED → CANCELLED)', async () => {
    setupUpdateMocks({ status: 'DELIVERED' })

    await expect(
      updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CANCELLED' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  // TASK-121: PENDING → CONFIRMED agora é permitido (admin confirma direto da coluna "Novo")
  it('permite transição direta PENDING → CONFIRMED (v2.4)', async () => {
    setupUpdateMocks({ status: 'PENDING' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' })

    const result = await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID)
    expect(result.status).toBe('CONFIRMED')
  })

  it('lança 422 quando status DISPATCHED aplicado em pedido de PICKUP', async () => {
    setupUpdateMocks({ status: 'READY', type: 'PICKUP' })

    await expect(
      updateOrderStatus(STORE_ID, ORDER_ID, { status: 'DISPATCHED' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })

  it('emite socket.io order:status após atualização', async () => {
    setupUpdateMocks({ status: 'WAITING_CONFIRMATION' })

    await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID)

    expect(mockEmit.orderStatus).toHaveBeenCalledWith(STORE_ID, { orderId: ORDER_ID, status: 'CONFIRMED' })
  })

  it('registra AuditLog com previousStatus e newStatus', async () => {
    setupUpdateMocks({ status: 'WAITING_CONFIRMATION' })

    await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID, IP)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'order.status_update',
          entity: 'Order',
          entityId: ORDER_ID,
          data: expect.objectContaining({ previousStatus: 'WAITING_CONFIRMATION', newStatus: 'CONFIRMED' }),
          ip: IP,
        }),
      })
    )
  })

  it('registra timestamps corretos para cada status', async () => {
    const statusTimestamps: Array<{ status: string; timestamp: string }> = [
      { status: 'CONFIRMED', timestamp: 'confirmedAt' },
      { status: 'READY', timestamp: 'preparedAt' },
      { status: 'DELIVERED', timestamp: 'deliveredAt' },
      { status: 'CANCELLED', timestamp: 'cancelledAt' },
    ]

    for (const { status, timestamp } of statusTimestamps) {
      jest.clearAllMocks()
      const validFrom = status === 'CONFIRMED' ? 'WAITING_CONFIRMATION'
        : status === 'READY' ? 'PREPARING'
        : status === 'DELIVERED' ? 'DISPATCHED'
        : 'DISPATCHED'

      setupUpdateMocks({ status: validFrom })

      await updateOrderStatus(STORE_ID, ORDER_ID, { status: status as any }, USER_ID)

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ [timestamp]: expect.any(Date) }),
        })
      )
    }
  })

  it('dispara autoPrintOrder via setImmediate quando status é CONFIRMED', async () => {
    setupUpdateMocks({ status: 'WAITING_CONFIRMATION' })
    await import('../print.service')
    const setImmediateSpy = jest.spyOn(global, 'setImmediate')

    await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CONFIRMED' }, USER_ID)

    expect(setImmediateSpy).toHaveBeenCalled()
    setImmediateSpy.mockRestore()
  })

  it('permite transições válidas: READY → DISPATCHED para pedidos DELIVERY', async () => {
    setupUpdateMocks({ status: 'READY', type: 'DELIVERY' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'DISPATCHED' })

    const result = await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'DISPATCHED' }, USER_ID)

    expect(result.status).toBe('DISPATCHED')
  })

  it('permite READY → DELIVERED (retirada sem passar por DISPATCHED)', async () => {
    setupUpdateMocks({ status: 'READY', type: 'PICKUP' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'DELIVERED' })

    const result = await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'DELIVERED' }, USER_ID)

    expect(result.status).toBe('DELIVERED')
  })

  // TASK-122: Cancelamento deve disparar WhatsApp
  it('dispara sendStatusUpdateMessage com CANCELLED ao cancelar pedido', async () => {
    const { sendStatusUpdateMessage } = await import('../../whatsapp/messages.service')
    const mockSendStatus = sendStatusUpdateMessage as jest.MockedFunction<typeof sendStatusUpdateMessage>
    mockSendStatus.mockClear()

    setupUpdateMocks({ status: 'PREPARING' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'CANCELLED' })

    await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CANCELLED', cancelReason: 'Cliente desistiu' }, USER_ID)

    // sendStatusUpdateMessage é chamado com CANCELLED + snapshot do pedido (total+items)
    expect(mockSendStatus).toHaveBeenCalledWith(
      STORE_ID,
      mockOrder.clientWhatsapp,
      mockOrder.number,
      'CANCELLED',
      mockStore.name,
      mockOrder.type,
      expect.objectContaining({
        total: expect.any(Number),
        items: expect.any(Array),
      })
    )
  })

  it('persiste cancelledAt timestamp ao cancelar', async () => {
    setupUpdateMocks({ status: 'PREPARING' })

    await updateOrderStatus(STORE_ID, ORDER_ID, { status: 'CANCELLED' }, USER_ID)

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
      })
    )
  })
})

// ─── assignMotoboy ────────────────────────────────────────────────────────────

describe('assignMotoboy', () => {
  const readyDeliveryOrder = {
    ...mockOrder,
    status: 'READY' as const,
    type: 'DELIVERY' as const,
    store: { id: STORE_ID, slug: 'pizzaria-do-ze' },
    items: mockOrder.items,
    client: mockOrder.client,
  }

  function setupAssignMocks(orderOverrides = {}) {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...readyDeliveryOrder, ...orderOverrides })
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({
      ...readyDeliveryOrder,
      motoboyId: MOTOBOY_ID,
      status: 'DISPATCHED',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  }

  it('atribui motoboy e muda status para DISPATCHED', async () => {
    setupAssignMocks()

    const result = await assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID, IP)

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motoboyId: MOTOBOY_ID,
          status: 'DISPATCHED',
          dispatchedAt: expect.any(Date),
        }),
      })
    )
    expect(result.status).toBe('DISPATCHED')
  })

  it('lança 404 quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando pedido pertence a outra loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...readyDeliveryOrder, storeId: 'outra-loja' })

    await expect(
      assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando pedido não está com status READY', async () => {
    setupAssignMocks({ status: 'PREPARING' })

    await expect(
      assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('lança 422 quando pedido não é do tipo DELIVERY', async () => {
    setupAssignMocks({ type: 'PICKUP' })

    await expect(
      assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 404 quando motoboy não existe na loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(readyDeliveryOrder)
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: 'nao-existe' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('emite socket.io order:status com DISPATCHED', async () => {
    setupAssignMocks()

    await assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID)

    expect(mockEmit.orderStatus).toHaveBeenCalledWith(STORE_ID, { orderId: ORDER_ID, status: 'DISPATCHED' })
  })

  it('registra AuditLog com motoboyId e motoboyName', async () => {
    setupAssignMocks()

    await assignMotoboy(STORE_ID, ORDER_ID, { motoboyId: MOTOBOY_ID }, USER_ID, IP)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'order.motoboy_assigned',
          entity: 'Order',
          entityId: ORDER_ID,
          data: expect.objectContaining({ motoboyId: MOTOBOY_ID, motoboyName: 'Carlos Moto' }),
        }),
      })
    )
  })
})

// ─── sendWaitingPaymentNotification (TASK-123) ────────────────────────────────

describe('sendWaitingPaymentNotification', () => {
  const pendingDeliveryOrder = {
    id: ORDER_ID,
    storeId: STORE_ID,
    type: 'DELIVERY' as const,
    status: 'PENDING' as const,
    clientWhatsapp: '5548999990001',
    number: 42,
  }

  function setupWaitingMocks(orderOverrides = {}) {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...pendingDeliveryOrder, ...orderOverrides })
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  }

  beforeEach(() => jest.clearAllMocks())

  it('retorna { success: true } para pedido DELIVERY + PENDING', async () => {
    setupWaitingMocks()

    const result = await sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID, IP)

    expect(result).toEqual({ success: true })
  })

  it('lança 404 quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando pedido pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ ...pendingDeliveryOrder, storeId: 'outra-loja' })

    await expect(
      sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 400 para pedido de PICKUP (não aplicável)', async () => {
    setupWaitingMocks({ type: 'PICKUP' })

    await expect(
      sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança 400 quando pedido não está com status PENDING', async () => {
    setupWaitingMocks({ status: 'CONFIRMED' })

    await expect(
      sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('registra AuditLog com action order.send_waiting_payment', async () => {
    setupWaitingMocks()

    await sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID, IP)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'order.send_waiting_payment',
          entity: 'Order',
          entityId: ORDER_ID,
          ip: IP,
        }),
      })
    )
  })

  it('NÃO muda o status do pedido (mantém PENDING na coluna Novos)', async () => {
    setupWaitingMocks()

    await sendWaitingPaymentNotification(STORE_ID, ORDER_ID, USER_ID)

    // order.update não deve ser chamado — status não muda
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })
})
