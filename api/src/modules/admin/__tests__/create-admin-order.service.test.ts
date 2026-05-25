// ─── PDV: createAdminOrder — Unit Tests ───────────────────────────────────────
// Cobre só a casca admin: resolução de slug pelo storeId, abertura/anexo de
// TableSession por tableId (sem token/QR), mapeamento de paymentMethod e o
// default de deviceName. O motor `createOrder` (menu) é mockado — sua lógica
// já é coberta por menu/__tests__/orders.service.test.ts.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    table: { findUnique: jest.fn() },
  },
}))

jest.mock('../../menu/orders.service', () => ({
  createOrder: jest.fn().mockResolvedValue({
    orderId: 'order-1',
    orderNumber: 1,
    token: 'jwt',
    total: 40,
    status: 'CONFIRMED',
  }),
}))

jest.mock('../../menu/table-session.service', () => ({
  openOrJoinSession: jest.fn().mockResolvedValue({
    token: 'table-session-token-aaaaaaaaaaaa',
    tableNumber: 5,
    status: 'OPEN',
    isNew: true,
  }),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { createOrder } from '../../menu/orders.service'
import { openOrJoinSession } from '../../menu/table-session.service'
import { createAdminOrder } from '../orders.service'
import type { CreateAdminOrderInput } from '../orders.schema'

const mockPrisma = prisma as unknown as {
  store: { findUnique: jest.Mock }
  table: { findUnique: jest.Mock }
}
const mockCreateOrder = createOrder as jest.Mock
const mockOpenOrJoin = openOrJoinSession as jest.Mock

const STORE_ID = '11111111-1111-4111-8111-111111111111'
const SLUG = 'pizzaria-do-ze'
const TABLE_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'

const baseItems = [
  { productId: PRODUCT_ID, variationId: undefined, quantity: 1, notes: undefined, addonIds: [] },
]

const deliveryInput: CreateAdminOrderInput = {
  clientName: 'João (telefone)',
  type: 'DELIVERY',
  paymentMethod: 'CASH',
  notes: undefined,
  couponCode: undefined,
  tableId: undefined,
  deviceName: undefined,
  deliveryNeighborhoodId: undefined,
  address: { street: 'Rua B', number: '100', neighborhood: 'Centro', city: 'Joinville' },
  scheduledFor: undefined,
  items: baseItems,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.store.findUnique.mockResolvedValue({ slug: SLUG })
  mockPrisma.table.findUnique.mockResolvedValue({ storeId: STORE_ID, accessToken: 'acc-token' })
})

describe('createAdminOrder — resolução de loja', () => {
  it('lança 404 quando a loja não existe', async () => {
    mockPrisma.store.findUnique.mockResolvedValue(null)

    await expect(createAdminOrder(STORE_ID, deliveryInput)).rejects.toMatchObject({ status: 404 })
  })

  it('resolve o slug pelo storeId e delega ao motor createOrder', async () => {
    await createAdminOrder(STORE_ID, deliveryInput)

    expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      select: { slug: true },
    })
    expect(mockCreateOrder).toHaveBeenCalledWith(SLUG, expect.objectContaining({ type: 'DELIVERY' }))
  })
})

describe('createAdminOrder — DELIVERY/PICKUP', () => {
  it('repassa paymentMethod limpo (CASH) e address ao motor', async () => {
    await createAdminOrder(STORE_ID, deliveryInput)

    const [, input] = mockCreateOrder.mock.calls[0]
    expect(input.paymentMethod).toBe('CASH')
    expect(input.address).toEqual(deliveryInput.address)
    expect(input.tableSessionToken).toBeUndefined()
  })

  it('não abre sessão de mesa para PICKUP', async () => {
    await createAdminOrder(STORE_ID, {
      ...deliveryInput,
      type: 'PICKUP',
      address: undefined,
    })

    expect(mockOpenOrJoin).not.toHaveBeenCalled()
    const [, input] = mockCreateOrder.mock.calls[0]
    expect(input.tableSessionToken).toBeUndefined()
    expect(input.deviceName).toBeUndefined()
  })
})

describe('createAdminOrder — TABLE', () => {
  const tableInput: CreateAdminOrderInput = {
    ...deliveryInput,
    type: 'TABLE',
    paymentMethod: 'PENDING',
    address: undefined,
    tableId: TABLE_ID,
  }

  it('lança 422 quando type=TABLE sem tableId', async () => {
    await expect(
      createAdminOrder(STORE_ID, { ...tableInput, tableId: undefined })
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 404 quando a mesa pertence a outra loja', async () => {
    mockPrisma.table.findUnique.mockResolvedValue({ storeId: 'outra-loja', accessToken: 'x' })

    await expect(createAdminOrder(STORE_ID, tableInput)).rejects.toMatchObject({ status: 404 })
    expect(mockOpenOrJoin).not.toHaveBeenCalled()
  })

  it('abre/anexa a sessão via openOrJoinSession e injeta o token no motor', async () => {
    await createAdminOrder(STORE_ID, tableInput)

    expect(mockOpenOrJoin).toHaveBeenCalledWith(STORE_ID, 'acc-token')
    const [, input] = mockCreateOrder.mock.calls[0]
    expect(input.tableSessionToken).toBe('table-session-token-aaaaaaaaaaaa')
    expect(input.type).toBe('TABLE')
  })

  it('usa deviceName "Balcão" como default em pedido de mesa sem nome do dispositivo', async () => {
    await createAdminOrder(STORE_ID, tableInput)

    const [, input] = mockCreateOrder.mock.calls[0]
    expect(input.deviceName).toBe('Balcão')
  })

  it('respeita deviceName informado pelo atendente', async () => {
    await createAdminOrder(STORE_ID, { ...tableInput, deviceName: 'Garçom Pedro' })

    const [, input] = mockCreateOrder.mock.calls[0]
    expect(input.deviceName).toBe('Garçom Pedro')
  })
})
