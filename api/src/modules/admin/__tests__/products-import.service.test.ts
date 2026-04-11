// ─── TASK-043: Produtos Importação CSV/XLSX — Unit Tests ──────────────────────

// ─── ExcelJS mock ─────────────────────────────────────────────────────────────

type CellValue = string | number | null

interface MockRow {
  cells: CellValue[]
  getCell: (index: number) => { value: CellValue }
}

function makeMockRow(cells: CellValue[]): MockRow {
  return {
    cells,
    getCell: (index: number) => ({ value: cells[index - 1] ?? null }),
  }
}

const mockRows: MockRow[] = []
let mockRowCount = 1

const mockSheet = {
  get rowCount() {
    return mockRowCount
  },
  columns: [] as unknown[],
  addRow: jest.fn(),
  getRow: jest.fn((index: number) => mockRows[index - 1] ?? makeMockRow([])),
  get font() {
    return {}
  },
  get fill() {
    return {}
  },
}

const mockWorkbook = {
  addWorksheet: jest.fn().mockReturnValue(mockSheet),
  xlsx: {
    writeBuffer: jest.fn().mockResolvedValue(Buffer.from('xlsx-content')),
    load: jest.fn(),
  },
  worksheets: [mockSheet],
}

jest.mock('exceljs', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockWorkbook),
}))

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    category: { findMany: jest.fn() },
    product: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    productVariation: { deleteMany: jest.fn(), createMany: jest.fn() },
    productAdditional: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: { del: jest.fn() },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { menuUpdated: jest.fn() },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { cache } from '../../../shared/redis/redis'
import { emit } from '../../../shared/socket/socket'
import { generateTemplate, importProducts } from '../products-import.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'user-1'

const mockCategories = [{ id: 'cat-1', name: 'Pizzas' }]

beforeEach(() => {
  jest.clearAllMocks()
  mockRows.length = 0
  mockRowCount = 1
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((fn: Function) => fn(mockPrisma))
  ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.product.create as jest.Mock).mockResolvedValue({ id: 'prod-new' })
  ;(mockPrisma.productVariation.createMany as jest.Mock).mockResolvedValue({ count: 0 })
  ;(mockPrisma.productAdditional.createMany as jest.Mock).mockResolvedValue({ count: 0 })
  ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
  ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})
})

// ─── generateTemplate ─────────────────────────────────────────────────────────

describe('generateTemplate', () => {
  it('returns a Buffer containing the XLSX template', async () => {
    const buffer = await generateTemplate()

    expect(buffer).toBeInstanceOf(Buffer)
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Produtos')
  })

  it('adds an example row to the template', async () => {
    await generateTemplate()

    expect(mockSheet.addRow).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: expect.any(String),
        categoria: expect.any(String),
      })
    )
  })
})

// ─── importProducts ───────────────────────────────────────────────────────────

function setupRows(rows: CellValue[][]) {
  // row index 0 = header (line 1), data starts at index 1
  mockRows.push(makeMockRow([]))  // header placeholder at index 0
  rows.forEach((cells) => mockRows.push(makeMockRow(cells)))
  mockRowCount = 1 + rows.length
}

const mockFile = { buffer: Buffer.from('mock-xlsx') } as Express.Multer.File

describe('importProducts — validation', () => {
  it('returns error for row with missing name', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['', null, null, 'Pizzas', null, null]])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.success).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ linha: 2, erro: expect.stringContaining('Nome') })
  })

  it('returns error for row with missing category', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['Pizza Margherita', null, null, '', null, null]])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.success).toBe(0)
    expect(result.errors[0]).toMatchObject({ linha: 2, erro: expect.stringContaining('Categoria') })
  })

  it('returns error for row with category not found in store', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['Pizza Margherita', null, null, 'Hamburguers', null, null]])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.errors[0]).toMatchObject({
      linha: 2,
      erro: expect.stringContaining('Hamburguers'),
    })
  })

  it('returns error for row with invalid price', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['Pizza Margherita', null, 'abc', 'Pizzas', null, null]])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.errors[0]).toMatchObject({ linha: 2, erro: 'Preço inválido' })
  })

  it('invalid rows do not block valid rows (linhas inválidas não bloqueiam válidas)', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([
      // Invalid row: missing name
      ['', null, null, 'Pizzas', null, null],
      // Valid row
      ['Pizza Calabresa', 'Com calabresa', 32.9, 'Pizzas', null, null],
    ])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.errors).toHaveLength(1)
    expect(result.success).toBe(1)
    expect(result.total).toBe(2)
  })
})

describe('importProducts — success', () => {
  it('creates valid products and returns success count', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([
      ['Pizza Margherita', 'Clássica', 35.9, 'Pizzas', null, null],
      ['Pizza Calabresa', 'Com calabresa', 32.9, 'Pizzas', null, null],
    ])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.success).toBe(2)
    expect(result.errors).toHaveLength(0)
    expect(result.total).toBe(2)
  })

  it('invalidates Redis cache and emits socket after successful import', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['Pizza Margherita', null, 35.9, 'Pizzas', null, null]])

    await importProducts(mockFile, STORE_ID, USER_ID)

    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })

  it('does not invalidate cache when no rows succeed', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    setupRows([['', null, null, 'Pizzas', null, null]])

    await importProducts(mockFile, STORE_ID, USER_ID)

    expect(mockCache.del).not.toHaveBeenCalled()
    expect(mockEmit.menuUpdated).not.toHaveBeenCalled()
  })

  it('upserts product by name (reimport sobrescreve)', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({
      id: 'prod-existing',
      name: 'Pizza Margherita',
    })
    ;(mockPrisma.product.update as jest.Mock).mockResolvedValue({ id: 'prod-existing' })
    ;(mockPrisma.productVariation.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.productAdditional.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    setupRows([['Pizza Margherita', 'Atualizada', 39.9, 'Pizzas', null, null]])

    const result = await importProducts(mockFile, STORE_ID, USER_ID)

    expect(result.success).toBe(1)
    expect(mockPrisma.product.update).toHaveBeenCalled()
    expect(mockPrisma.product.create).not.toHaveBeenCalled()
  })
})
