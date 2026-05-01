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
      addPage: jest.fn().mockReturnThis(),
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
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    tableSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    orderItem: { findFirst: jest.fn(), update: jest.fn() },
    cashFlow: { findFirst: jest.fn() },
    cashFlowItem: { findUnique: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    itemStatus: jest.fn(),
    menuUpdated: jest.fn(),
    orderStatus: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import {
  closeTable,
  confirmTableSessionPayment,
  createTable,
  generateAllQRCodesPDF,
  generateQRCode,
  generateQRCodePDF,
  getTableComanda,
  setTablesCount,
  updateOrderItemStatus,
} from '../tables.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'user-1'
const TABLE_ID = 'table-1'

const ACCESS_TOKEN = 'a1b2c3d4e5f6a7b8'

const mockTable = {
  id: TABLE_ID,
  storeId: STORE_ID,
  number: 5,
  isOccupied: true,
  createdAt: new Date(),
  accessToken: ACCESS_TOKEN,
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
    // v2.7: URL usa accessToken (hash) em vez do número da mesa.
    expect(result.url).toContain(`/mesa/${ACCESS_TOKEN}`)
  })

  it('builds full URL as https://{slug}.{rootDomain}/mesa/{accessToken}', async () => {
    const originalDomain = process.env.PUBLIC_ROOT_DOMAIN
    delete process.env.PUBLIC_ROOT_DOMAIN

    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await generateQRCode(STORE_ID, TABLE_ID)

    expect(result.url).toBe(`https://minha-loja.menupanda.com.br/mesa/${ACCESS_TOKEN}`)

    process.env.PUBLIC_ROOT_DOMAIN = originalDomain
  })

  it('uses custom PUBLIC_ROOT_DOMAIN when set', async () => {
    const originalDomain = process.env.PUBLIC_ROOT_DOMAIN
    process.env.PUBLIC_ROOT_DOMAIN = 'custom.domain.com'

    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await generateQRCode(STORE_ID, TABLE_ID)

    expect(result.url).toBe(`https://minha-loja.custom.domain.com/mesa/${ACCESS_TOKEN}`)

    process.env.PUBLIC_ROOT_DOMAIN = originalDomain
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

describe('closeTable — fecha sessão e todos os pedidos', () => {
  const mockOrderA = {
    id: 'order-a',
    paymentReceivedAt: new Date(),
    items: [
      { id: 'item-1', totalPrice: 50, additionals: [] },
      { id: 'item-2', totalPrice: 30, additionals: [] },
    ],
  }
  const mockOrderB = {
    id: 'order-b',
    paymentReceivedAt: new Date(),
    items: [{ id: 'item-3', totalPrice: 20, additionals: [] }],
  }
  const mockSession = {
    id: 'session-1',
    storeId: STORE_ID,
    tableId: TABLE_ID,
    status: 'OPEN' as const,
    orders: [mockOrderA, mockOrderB],
  }

  beforeEach(() => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(mockSession)
    ;(mockPrisma.tableSession.update as jest.Mock).mockResolvedValue({
      ...mockSession,
      status: 'CLOSED',
    })
    ;(mockPrisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(mockPrisma.table.update as jest.Mock).mockResolvedValue({ ...mockTable, isOccupied: false })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('calculates total with 10% service charge over sum of all session orders', async () => {
    const result = await closeTable(
      STORE_ID,
      TABLE_ID,
      { applyServiceCharge: true, serviceChargePercent: 10 },
      USER_ID
    )

    // subtotal = 100, serviceCharge = 10, total = 110
    expect(result.subtotal).toBe(100)
    expect(result.serviceCharge).toBe(10)
    expect(result.total).toBe(110)
    expect(result.ordersClosed).toBe(2)
  })

  it('calculates total without service charge', async () => {
    const result = await closeTable(
      STORE_ID,
      TABLE_ID,
      { applyServiceCharge: false },
      USER_ID
    )

    expect(result.subtotal).toBe(100)
    expect(result.serviceCharge).toBe(0)
    expect(result.total).toBe(100)
  })

  it('marks session CLOSED, frees table, and bulks all session orders to DELIVERED', async () => {
    await closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)

    expect(mockPrisma.tableSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ status: 'CLOSED' }),
      })
    )
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['order-a', 'order-b'] } },
      data: { status: 'DELIVERED' },
    })
    expect(mockPrisma.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isOccupied: false } })
    )
  })

  it('throws 404 when table not found', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when table has no open session', async () => {
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      closeTable(STORE_ID, TABLE_ID, { applyServiceCharge: false }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── getTableComanda ─────────────────────────────────────────────────────────

describe('getTableComanda', () => {
  it('returns table with open session, aggregated items and subtotal', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      openedAt: new Date(),
      orders: [
        {
          id: 'order-1',
          number: 1,
          deviceName: 'Fabio',
          createdAt: new Date(),
          items: [{ id: 'item-1', totalPrice: 45, additionals: [] }],
        },
      ],
    })

    const result = await getTableComanda(STORE_ID, TABLE_ID)

    expect(result.subtotal).toBe(45)
    expect(result.total).toBe(45)
    expect(result.items).toHaveLength(1)
    expect(result.session).not.toBeNull()
  })

  it('returns empty comanda when there is no open session', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getTableComanda(STORE_ID, TABLE_ID)

    expect(result.session).toBeNull()
    expect(result.items).toHaveLength(0)
    expect(result.subtotal).toBe(0)
  })
})

// ─── updateOrderItemStatus ────────────────────────────────────────────────────

describe('updateOrderItemStatus', () => {
  it('updates item status and emits socket event', async () => {
    const mockItem = { id: 'item-1', orderId: 'order-1', status: 'PENDING' }
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(mockItem)
    ;(mockPrisma.orderItem.update as jest.Mock).mockResolvedValue({
      ...mockItem,
      status: 'DELIVERED',
    })
    // Order já CONFIRMED — não dispara o auto-confirm.
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ status: 'CONFIRMED' })

    const result = await updateOrderItemStatus(
      STORE_ID,
      TABLE_ID,
      'item-1',
      { status: 'DELIVERED' },
      USER_ID
    )

    expect(result.status).toBe('DELIVERED')
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
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

  // Mover item pra fora de PENDING é confirmação implícita do garçom — sem isso
  // o card da mesa fica preso em "Pedido novo" mesmo com itens já em preparo.
  it('auto-confirma o Order quando item sai de PENDING e Order está em WAITING_CONFIRMATION', async () => {
    const mockItem = { id: 'item-1', orderId: 'order-1', status: 'PENDING' }
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(mockItem)
    ;(mockPrisma.orderItem.update as jest.Mock).mockResolvedValue({ ...mockItem, status: 'PREPARING' })
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ status: 'WAITING_CONFIRMATION' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({})

    await updateOrderItemStatus(STORE_ID, TABLE_ID, 'item-1', { status: 'PREPARING' }, USER_ID)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ status: 'CONFIRMED' }),
    })
    expect(mockEmit.orderStatus).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({ orderId: 'order-1', status: 'CONFIRMED' })
    )
  })

  it('auto-confirma também quando Order está em WAITING_PAYMENT_PROOF (PIX)', async () => {
    const mockItem = { id: 'item-2', orderId: 'order-2', status: 'PENDING' }
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(mockItem)
    ;(mockPrisma.orderItem.update as jest.Mock).mockResolvedValue({ ...mockItem, status: 'DELIVERED' })
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({ status: 'WAITING_PAYMENT_PROOF' })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({})

    await updateOrderItemStatus(STORE_ID, TABLE_ID, 'item-2', { status: 'DELIVERED' }, USER_ID)

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-2' },
      data: expect.objectContaining({ status: 'CONFIRMED' }),
    })
  })

  it('NÃO mexe no Order quando devolve item pra PENDING', async () => {
    const mockItem = { id: 'item-3', orderId: 'order-3', status: 'PREPARING' }
    ;(mockPrisma.orderItem.findFirst as jest.Mock).mockResolvedValue(mockItem)
    ;(mockPrisma.orderItem.update as jest.Mock).mockResolvedValue({ ...mockItem, status: 'PENDING' })

    await updateOrderItemStatus(STORE_ID, TABLE_ID, 'item-3', { status: 'PENDING' }, USER_ID)

    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })
})

// ─── setTablesCount ──────────────────────────────────────────────────────────

describe('setTablesCount', () => {
  beforeEach(() => {
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.table.createMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.table.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('creates missing tables 1..N when starting from zero', async () => {
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue([])

    await setTablesCount(STORE_ID, 5, USER_ID)

    // accessToken é gerado dinamicamente (randomBytes), por isso objectContaining.
    expect(mockPrisma.table.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ storeId: STORE_ID, number: 1, accessToken: expect.stringMatching(/^[a-f0-9]{16}$/) }),
        expect.objectContaining({ storeId: STORE_ID, number: 2, accessToken: expect.stringMatching(/^[a-f0-9]{16}$/) }),
        expect.objectContaining({ storeId: STORE_ID, number: 3, accessToken: expect.stringMatching(/^[a-f0-9]{16}$/) }),
        expect.objectContaining({ storeId: STORE_ID, number: 4, accessToken: expect.stringMatching(/^[a-f0-9]{16}$/) }),
        expect.objectContaining({ storeId: STORE_ID, number: 5, accessToken: expect.stringMatching(/^[a-f0-9]{16}$/) }),
      ],
    })
  })

  it('removes only tables with number > target when no open session', async () => {
    const existing = [
      { id: 't1', storeId: STORE_ID, number: 1, isOccupied: false },
      { id: 't2', storeId: STORE_ID, number: 2, isOccupied: false },
      { id: 't3', storeId: STORE_ID, number: 3, isOccupied: false },
    ]
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue(existing)

    await setTablesCount(STORE_ID, 2, USER_ID)

    expect(mockPrisma.table.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['t3'] } },
    })
  })

  it('throws 422 if a table to be removed has an open session', async () => {
    const existing = [
      { id: 't1', storeId: STORE_ID, number: 1, isOccupied: false },
      { id: 't2', storeId: STORE_ID, number: 2, isOccupied: true },
    ]
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue(existing)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'sess',
      tableId: 't2',
      status: 'OPEN',
    })

    await expect(setTablesCount(STORE_ID, 1, USER_ID)).rejects.toMatchObject({
      status: 422,
    })
    expect(mockPrisma.table.deleteMany).not.toHaveBeenCalled()
  })
})

// ─── confirmTableSessionPayment ──────────────────────────────────────────────

describe('confirmTableSessionPayment', () => {
  beforeEach(() => {
    ;(mockPrisma.cashFlow.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
  })

  it('marks all unpaid orders of the session as paid with given method', async () => {
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      storeId: STORE_ID,
      tableId: TABLE_ID,
      status: 'OPEN',
      orders: [
        { id: 'order-1', paymentReceivedAt: null, status: 'CONFIRMED' },
        { id: 'order-2', paymentReceivedAt: null, status: 'WAITING_CONFIRMATION' },
      ],
    })

    const result = await confirmTableSessionPayment(
      STORE_ID,
      TABLE_ID,
      { paymentMethod: 'PIX' },
      USER_ID
    )

    expect(result.ordersPaid).toBe(2)
    expect(result.paymentMethod).toBe('PIX')
    expect(result.alreadyPaid).toBe(false)
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: 'PIX' }),
      })
    )
  })

  it('returns alreadyPaid when all orders already had paymentReceivedAt', async () => {
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      storeId: STORE_ID,
      tableId: TABLE_ID,
      status: 'OPEN',
      orders: [{ id: 'order-1', paymentReceivedAt: new Date() }],
    })

    const result = await confirmTableSessionPayment(
      STORE_ID,
      TABLE_ID,
      { paymentMethod: 'CASH' },
      USER_ID
    )

    expect(result.alreadyPaid).toBe(true)
    expect(result.ordersPaid).toBe(0)
  })

  it('throws 422 when session is not open', async () => {
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      confirmTableSessionPayment(STORE_ID, TABLE_ID, { paymentMethod: 'PIX' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── generateAllQRCodesPDF ──────────────────────────────────────────────────

describe('generateAllQRCodesPDF', () => {
  it('returns a Buffer with PDF content for all tables', async () => {
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', storeId: STORE_ID, number: 1, isOccupied: false, createdAt: new Date() },
      { id: 't2', storeId: STORE_ID, number: 2, isOccupied: false, createdAt: new Date() },
    ])
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const result = await generateAllQRCodesPDF(STORE_ID)

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('throws 422 when there are no tables', async () => {
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue([])

    await expect(generateAllQRCodesPDF(STORE_ID)).rejects.toMatchObject({ status: 422 })
  })
})
