// Comanda pública — Unit tests (filtra por TableSession token).

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    tableSession: { findUnique: jest.fn(), update: jest.fn() },
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
import { getCustomerComandaBySession, requestTableCheckBySession } from '../comanda.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const TOKEN = 'session-token-abc'

const mockSessionOpen = {
  id: 'session-1',
  storeId: STORE_ID,
  tableId: 'table-uuid-1',
  token: TOKEN,
  status: 'OPEN' as const,
  openedAt: new Date(),
  closedAt: null,
  closedBy: null,
  checkRequestedAt: null,
  table: { id: 'table-uuid-1', storeId: STORE_ID, number: 5, isOccupied: true, createdAt: new Date() },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getCustomerComandaBySession', () => {
  it('returns aggregated items from multiple orders of the open session', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue(mockSessionOpen)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'order-1',
        number: 100,
        createdAt: new Date(),
        deviceName: 'Fabio',
        items: [
          { id: 'item-1', totalPrice: 30, additionals: [] },
          { id: 'item-2', totalPrice: 20, additionals: [] },
        ],
      },
      {
        id: 'order-2',
        number: 101,
        createdAt: new Date(),
        deviceName: 'Igor',
        items: [{ id: 'item-3', totalPrice: 15, additionals: [] }],
      },
    ])

    const result = await getCustomerComandaBySession(STORE_ID, TOKEN)

    expect(result.table.number).toBe(5)
    expect(result.orders).toHaveLength(2)
    expect(result.items).toHaveLength(3)
    expect(result.subtotal).toBe(65)
    expect(result.total).toBe(65)
  })

  it('throws 404 when token does not exist', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getCustomerComandaBySession(STORE_ID, TOKEN)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('throws 404 when token belongs to another store', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      ...mockSessionOpen,
      storeId: 'other-store',
    })

    await expect(getCustomerComandaBySession(STORE_ID, TOKEN)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('throws 410 when session is closed', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      ...mockSessionOpen,
      status: 'CLOSED',
    })

    await expect(getCustomerComandaBySession(STORE_ID, TOKEN)).rejects.toMatchObject({
      status: 410,
    })
  })

  it('filters orders by tableSessionId and excludes cancelled', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue(mockSessionOpen)
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])

    await getCustomerComandaBySession(STORE_ID, TOKEN)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tableSessionId: 'session-1',
          status: { not: 'CANCELLED' },
        }),
      })
    )
  })
})

describe('requestTableCheckBySession', () => {
  it('persiste checkRequestedAt e emite socket event', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue(mockSessionOpen)

    const result = await requestTableCheckBySession(STORE_ID, TOKEN, '54999990000')

    expect(result.success).toBe(true)
    expect(mockPrisma.tableSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: expect.objectContaining({ checkRequestedAt: expect.any(Date) }),
    })
    expect(mockEmit.tableCheckRequested).toHaveBeenCalledWith(STORE_ID, {
      tableId: 'table-uuid-1',
      tableNumber: 5,
      customerWhatsapp: '54999990000',
    })
  })

  // Idempotente: cliente clica "Pedir conta" 3x → admin não vê 3 timestamps
  // diferentes nem 3 toasts duplicados de pulse no card.
  it('NÃO sobrescreve checkRequestedAt quando já existe (idempotente)', async () => {
    const existing = new Date('2026-05-01T12:00:00Z')
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      ...mockSessionOpen,
      checkRequestedAt: existing,
    })

    await requestTableCheckBySession(STORE_ID, TOKEN, '54999990000')

    expect(mockPrisma.tableSession.update).not.toHaveBeenCalled()
    // Mas continua emitindo o socket — admin que perdeu o evento pega no replay.
    expect(mockEmit.tableCheckRequested).toHaveBeenCalled()
  })

  it('throws 410 when session is closed', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      ...mockSessionOpen,
      status: 'CLOSED',
    })

    await expect(requestTableCheckBySession(STORE_ID, TOKEN, '54999990000')).rejects.toMatchObject({
      status: 410,
    })
  })
})
