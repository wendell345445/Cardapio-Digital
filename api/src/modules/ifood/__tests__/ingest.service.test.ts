// ─── Ingestão de pedidos iFood → Order local ─────────────────────────────────
// Cobre: mapIFoodOrder (mapper puro), dedup de eventos, criação/atualização do
// Order local, e o comportamento de ACK (processedAt só no sucesso).

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    iFoodEventLog: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    iFoodOrderMap: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderNew: jest.fn(), orderUpdated: jest.fn() },
}))

jest.mock('../../admin/cashflow.service', () => ({
  linkOrderToCashFlow: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../admin/print.service', () => ({
  autoPrintOrder: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../actions.service', () => ({
  reflectStatusToIFood: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../shared/ifood/ifood.service', () => ({
  getOrder: jest.fn(),
}))

jest.mock('../../../shared/logger/logger', () => ({
  asaasLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

// withStoreLock roda o callback direto (sem serialização real no teste).
jest.mock('../../../shared/utils/store-lock', () => ({
  withStoreLock: (_storeId: string, fn: () => Promise<unknown>) => fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import { linkOrderToCashFlow } from '../../admin/cashflow.service'
import { autoPrintOrder } from '../../admin/print.service'
import { getOrder, type IFoodOrder } from '../../../shared/ifood/ifood.service'
import { reflectStatusToIFood } from '../actions.service'
import { mapIFoodOrder, processIFoodEvent } from '../ingest.service'

const STORE = { id: 'store-1', autoConfirmOrders: false }

describe('mapIFoodOrder', () => {
  it('mapeia DELIVERY com endereço, itens e opções (optionGroups)', () => {
    const order = {
      id: 'if-1',
      displayId: '1234',
      orderType: 'DELIVERY',
      total: { orderAmount: 55.5, deliveryFee: 5.5, subTotal: 50 },
      customer: { name: 'João', phone: { localizer: '551140028922' } },
      delivery: {
        deliveryAddress: {
          streetName: 'Rua A',
          streetNumber: '100',
          neighborhood: 'Centro',
          city: 'SP',
          state: 'SP',
          postalCode: '01000-000',
          coordinates: { latitude: -23.5, longitude: -46.6 },
        },
      },
      items: [
        {
          name: 'X-Burger',
          quantity: 2,
          unitPrice: 20,
          totalPrice: 40,
          observations: 'sem cebola',
          optionGroups: [{ options: [{ name: 'Bacon', price: 5 }] }],
        },
      ],
    } as unknown as IFoodOrder

    const m = mapIFoodOrder(order)
    expect(m.type).toBe('DELIVERY')
    expect(m.total).toBe(55.5)
    expect(m.deliveryFee).toBe(5.5)
    expect(m.subtotal).toBe(50)
    expect(m.clientName).toBe('João')
    expect(m.address?.street).toBe('Rua A')
    expect(m.address?.neighborhood).toBe('Centro')
    expect(m.address?.latitude).toBe(-23.5)
    expect(m.notes).toContain('[iFood #1234]')
    expect(m.notes).toContain('551140028922')
    expect(m.items).toHaveLength(1)
    expect(m.items[0]).toMatchObject({ quantity: 2, unitPrice: 20, productName: 'X-Burger', notes: 'sem cebola' })
    expect(m.items[0].additionals).toEqual([{ name: 'Bacon', price: 5 }])
  })

  it('TAKEOUT vira PICKUP e não traz endereço', () => {
    const order = {
      id: 'if-2',
      orderType: 'TAKEOUT',
      total: { orderAmount: 30, deliveryFee: 0 },
      customer: { name: 'Maria' },
      delivery: { deliveryAddress: { streetName: 'ignorada' } },
      items: [],
    } as unknown as IFoodOrder

    const m = mapIFoodOrder(order)
    expect(m.type).toBe('PICKUP')
    expect(m.address).toBeNull()
  })

  it('é defensivo com campos ausentes (subtotal derivado, nomes default)', () => {
    const order = {
      id: 'if-3',
      total: { orderAmount: 40, deliveryFee: 10 },
      items: [{ totalPrice: 30, quantity: 3 }],
    } as unknown as IFoodOrder

    const m = mapIFoodOrder(order)
    expect(m.type).toBe('DELIVERY')
    expect(m.subtotal).toBe(30) // orderAmount - deliveryFee
    expect(m.clientName).toBe('Cliente iFood')
    expect(m.items[0].productName).toBe('Item iFood')
    expect(m.items[0].unitPrice).toBe(10) // 30/3
  })
})

describe('processIFoodEvent — dedup e ACK', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(prisma.iFoodEventLog.upsert as jest.Mock).mockResolvedValue({})
    ;(prisma.iFoodEventLog.update as jest.Mock).mockResolvedValue({})
    // resetAllMocks limpa a impl do factory mock (CLAUDE.md gotcha #2) — re-aplica.
    ;(linkOrderToCashFlow as jest.Mock).mockResolvedValue(undefined)
    ;(autoPrintOrder as jest.Mock).mockResolvedValue(undefined)
    ;(reflectStatusToIFood as jest.Mock).mockResolvedValue(undefined)
  })

  // createLocalOrder dispara reflect/print via setImmediate — flush a fila.
  const flushImmediate = () => new Promise((r) => setImmediate(r))

  function mockPlacedCreate() {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValue({ number: 41 })
    ;(getOrder as jest.Mock).mockResolvedValue({
      id: 'if-1',
      orderType: 'DELIVERY',
      total: { orderAmount: 10, deliveryFee: 0 },
      customer: { name: 'Cli' },
      items: [],
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        order: { create: jest.fn().mockResolvedValue({ id: 'order-1', items: [] }) },
        iFoodOrderMap: { create: jest.fn().mockResolvedValue({}) },
      })
    )
  }

  it('evento já processado (processedAt) → no-op', async () => {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue({ processedAt: new Date() })

    await processIFoodEvent(STORE, { id: 'ev-1', orderId: 'if-1', code: 'CONFIRMED' })

    expect(prisma.iFoodEventLog.upsert).not.toHaveBeenCalled()
    expect(getOrder).not.toHaveBeenCalled()
  })

  it('PLACED cria o Order local e marca o evento como processado', async () => {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValue({ number: 41 })
    ;(getOrder as jest.Mock).mockResolvedValue({
      id: 'if-1',
      orderType: 'DELIVERY',
      total: { orderAmount: 10, deliveryFee: 0 },
      customer: { name: 'Cli' },
      items: [],
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        order: { create: jest.fn().mockResolvedValue({ id: 'order-1', items: [] }) },
        iFoodOrderMap: { create: jest.fn().mockResolvedValue({}) },
      })
    )

    await processIFoodEvent(STORE, { id: 'ev-2', orderId: 'if-1', code: 'PLACED' })

    expect(getOrder).toHaveBeenCalledWith('if-1')
    expect(emit.orderNew).toHaveBeenCalledWith('store-1', expect.objectContaining({ id: 'order-1' }))
    expect(prisma.iFoodEventLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processedAt: expect.any(Date) }) })
    )
  })

  it('auto-confirm OFF: pedido nasce WAITING_CONFIRMATION e NÃO reflete confirm pro iFood', async () => {
    mockPlacedCreate()

    await processIFoodEvent({ id: 'store-1', autoConfirmOrders: false }, { id: 'ev-2b', orderId: 'if-1', code: 'PLACED' })
    await flushImmediate()

    expect(reflectStatusToIFood).not.toHaveBeenCalled()
    expect(autoPrintOrder).not.toHaveBeenCalled()
  })

  it('auto-confirm ON: pedido nasce CONFIRMED e REFLETE confirm pro iFood + auto-print', async () => {
    mockPlacedCreate()

    await processIFoodEvent({ id: 'store-1', autoConfirmOrders: true }, { id: 'ev-2c', orderId: 'if-1', code: 'PLACED' })
    await flushImmediate()

    // O bug corrigido: com auto-confirm, o iFood PRECISA receber o confirmOrder
    // (senão cancela o pedido por timeout), mesmo sem passar por updateOrderStatus.
    expect(reflectStatusToIFood).toHaveBeenCalledWith('store-1', 'order-1', 'CONFIRMED')
    expect(autoPrintOrder).toHaveBeenCalledWith('order-1')
  })

  it('PLACED duplicado (map já existe) não recria o pedido', async () => {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({ id: 'map-1' })
    ;(getOrder as jest.Mock).mockResolvedValue({ id: 'if-1', total: {}, items: [] })

    await processIFoodEvent(STORE, { id: 'ev-3', orderId: 'if-1', code: 'PLACED' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(emit.orderNew).not.toHaveBeenCalled()
    // ainda marca processado (não é erro — só idempotência)
    expect(prisma.iFoodEventLog.update).toHaveBeenCalled()
  })

  it('CONFIRMED atualiza o status local (sem regredir terminal)', async () => {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      order: { id: 'order-1', status: 'WAITING_CONFIRMATION' },
    })
    ;(prisma.order.update as jest.Mock).mockResolvedValue({ id: 'order-1', items: [] })

    await processIFoodEvent(STORE, { id: 'ev-4', orderId: 'if-1', code: 'CONFIRMED' })

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
    expect(emit.orderUpdated).toHaveBeenCalled()
  })

  it('falha no processamento NÃO marca processedAt (retry no próximo poll)', async () => {
    ;(prisma.iFoodEventLog.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue(null)
    ;(getOrder as jest.Mock).mockRejectedValue(new Error('iFood 500'))

    await processIFoodEvent(STORE, { id: 'ev-5', orderId: 'if-1', code: 'PLACED' })

    // upsert do log rodou, mas update com processedAt não
    expect(prisma.iFoodEventLog.upsert).toHaveBeenCalled()
    expect(prisma.iFoodEventLog.update).not.toHaveBeenCalled()
  })
})
