// ─── A-056: Comanda pública do cliente — Unit Tests ──────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    table: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    tableCheckRequested: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import { getCustomerComanda, requestTableCheck } from '../comanda.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'

const mockTable = {
  id: 'table-uuid-1',
  storeId: STORE_ID,
  number: 5,
  isOccupied: true,
  createdAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── getCustomerComanda ──────────────────────────────────────────────────────

describe('getCustomerComanda', () => {
  it('returns aggregated items from multiple orders', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'order-1',
        number: 100,
        createdAt: new Date(),
        items: [
          { id: 'item-1', totalPrice: 30, additionals: [] },
          { id: 'item-2', totalPrice: 20, additionals: [] },
        ],
      },
      {
        id: 'order-2',
        number: 101,
        createdAt: new Date(),
        items: [
          { id: 'item-3', totalPrice: 15, additionals: [] },
        ],
      },
    ])

    const result = await getCustomerComanda(STORE_ID, 5)

    expect(result.table.number).toBe(5)
    expect(result.orders).toHaveLength(2)
    expect(result.items).toHaveLength(3)
    expect(result.subtotal).toBe(65)
    expect(result.total).toBe(65)
  })

  it('returns empty when no active orders', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    const result = await getCustomerComanda(STORE_ID, 5)

    expect(result.items).toHaveLength(0)
    expect(result.subtotal).toBe(0)
  })

  it('throws 404 for nonexistent table', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getCustomerComanda(STORE_ID, 99)).rejects.toMatchObject({ status: 404 })
  })

  it('excludes cancelled orders (uses status not CANCELLED filter)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await getCustomerComanda(STORE_ID, 5)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'CANCELLED' },
        }),
      })
    )
  })
})

// ─── requestTableCheck ───────────────────────────────────────────────────────

describe('requestTableCheck', () => {
  it('emits socket event with table data', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)

    const result = await requestTableCheck(STORE_ID, 5, '54999990000')

    expect(result.success).toBe(true)
    expect(mockEmit.tableCheckRequested).toHaveBeenCalledWith(STORE_ID, {
      tableId: 'table-uuid-1',
      tableNumber: 5,
      customerWhatsapp: '54999990000',
    })
  })

  it('throws 404 for nonexistent table', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(requestTableCheck(STORE_ID, 99, '54999990000')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('throws 422 for unoccupied table', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue({
      ...mockTable,
      isOccupied: false,
    })

    await expect(requestTableCheck(STORE_ID, 5, '54999990000')).rejects.toMatchObject({
      status: 422,
    })
  })
})
