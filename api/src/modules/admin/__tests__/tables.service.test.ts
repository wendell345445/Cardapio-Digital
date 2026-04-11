// ─── TASK-044: QR Code de Mesa e Comanda — Unit Tests ────────────────────────

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK'),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('qr-mock')),
}))

jest.mock('pdfkit', () => {
  const EventEmitter = require('events')
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter()
    const doc = Object.assign(emitter, {
      page: { width: 595 },
      y: 100,
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      end: jest.fn().mockImplementation(function () {
        emitter.emit('data', Buffer.from('pdf'))
        emitter.emit('end')
      }),
    })
    return doc
  })
})

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    table: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), update: jest.fn() },
    orderItem: { findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    itemStatus: jest.fn(),
    menuUpdated: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import {
  createTable,
  generateQRCode,
  generateQRCodePDF,
  closeTable,
  getTableComanda,
  updateOrderItemStatus,
} from '../tables.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'user-1'
const TABLE_ID = 'table-1'

const mockTable = {
  id: TABLE_ID,
  storeId: STORE_ID,
  number: 5,
  isOccupied: true,
  createdAt: new Date(),
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((input) => {
    if (typeof input === 'function') return input(mockPrisma)
    return Promise.all(input)
  })
})

// ─── createTable ──────────────────────────────────────────────────────────────

describe('createTable', () => {
  it('creates table and records audit log', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.table.create as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createTable(STORE_ID, { number: 5 }, USER_ID)

    expect(result.number).toBe(5)
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('throws 422 when table number already exists in the store', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)

    await expect(createTable(STORE_ID, { number: 5 }, USER_ID)).rejects.toMatchObject({
      status: 422,
    })
  })
})

// ─── generateQRCode ───────────────────────────────────────────────────────────

describe('generateQRCode', () => {
  it('generates QR code data URL with table URL', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await generateQRCode(STORE_ID, TABLE_ID)

    expect(result.qrDataUrl).toContain('data:image/png')
    expect(result.tableNumber).toBe(5)
    expect(result.url).toContain('mesa=5')
  })

  it('throws 404 when table not found', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(generateQRCode(STORE_ID, TABLE_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── generateQRCodePDF ────────────────────────────────────────────────────────

describe('generateQRCodePDF', () => {
  it('returns a Buffer with PDF content (A4 com logo e número)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await generateQRCodePDF(STORE_ID, TABLE_ID)

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })
})

// ─── closeTable — cálculo de total com taxa de serviço ───────────────────────

describe('closeTable — total calculation', () => {
  const mockItems = [
    { id: 'item-1', totalPrice: 50, additionals: [] },
    { id: 'item-2', totalPrice: 30, additionals: [] },
  ]
  const mockOrder = { id: 'order-1', items: mockItems }

  beforeEach(() => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
    ;(mockPrisma.table.update as jest.Mock).mockResolvedValue({ ...mockTable, isOccupied: false })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'DELIVERED' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('calculates total with 10% service charge applied', async () => {
    const result = await closeTable(
      STORE_ID,
      TABLE_ID,
      { applyServiceCharge: true, serviceChargePercent: 10 },
      USER_ID
    )

    // subtotal = 80, serviceCharge = 8, total = 88
    expect(result.subtotal).toBe(80)
    expect(result.serviceCharge).toBe(8)
    expect(result.total).toBe(88)
  })

  it('calculates total without service charge (taxa opcional)', async () => {
    const result = await closeTable(
      STORE_ID,
      TABLE_ID,
      { applyServiceCharge: false },
      USER_ID
    )

    expect(result.subtotal).toBe(80)
    expect(result.serviceCharge).toBe(0)
    expect(result.total).toBe(80)
  })

  it('calculates correct total with custom service charge percentage', async () => {
    const result = await closeTable(
      STORE_ID,
      TABLE_ID,
      { applyServiceCharge: true, serviceChargePercent: 15 },
      USER_ID
    )

    // subtotal = 80, serviceCharge = 12, total = 92
    expect(result.serviceCharge).toBeCloseTo(12)
    expect(result.total).toBeCloseTo(92)
  })

  it('frees table (isOccupied = false) and marks order DELIVERED on close', async () => {
    await closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isOccupied: false } })
    )
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DELIVERED' } })
    )
  })

  it('throws 404 when table not found', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when table has no open comanda (mesa sem comanda aberta)', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── getTableComanda ─────────────────────────────────────────────────────────

describe('getTableComanda', () => {
  it('returns table with open order and subtotal', async () => {
    const mockItems = [{ id: 'item-1', totalPrice: 45, additionals: [] }]
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      items: mockItems,
    })

    const result = await getTableComanda(STORE_ID, TABLE_ID)

    expect(result.subtotal).toBe(45)
    expect(result.total).toBe(45)
    expect(result.items).toHaveLength(1)
  })

  it('returns empty comanda when no open order exists', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getTableComanda(STORE_ID, TABLE_ID)

    expect(result.order).toBeNull()
    expect(result.items).toHaveLength(0)
    expect(result.subtotal).toBe(0)
  })
})

// ─── updateOrderItemStatus ────────────────────────────────────────────────────

describe('updateOrderItemStatus', () => {
  it('updates item status and emits socket event', async () => {
    const mockItem = { id: 'item-1', status: 'PENDING' }
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(mockItem)
    ;(mockPrisma.orderItem.update as jest.Mock).mockResolvedValue({
      ...mockItem,
      status: 'DELIVERED',
    })

    const result = await updateOrderItemStatus(
      STORE_ID,
      TABLE_ID,
      'item-1',
      { status: 'DELIVERED' },
      USER_ID
    )

    expect(result.status).toBe('DELIVERED')
    expect(mockEmit.itemStatus).toHaveBeenCalledWith(
      STORE_ID,
      TABLE_ID,
      expect.objectContaining({ itemId: 'item-1', status: 'DELIVERED' })
    )
  })

  it('throws 404 when item not found in this table', async () => {
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      updateOrderItemStatus(STORE_ID, TABLE_ID, 'nonexistent', { status: 'DELIVERED' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
