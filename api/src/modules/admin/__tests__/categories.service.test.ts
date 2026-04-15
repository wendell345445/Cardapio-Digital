// ─── TASK-040: Categorias CRUD — Unit Tests ──────────────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    auditLog: { create: jest.fn() },
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
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../categories.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'user-1'

const mockCategory = {
  id: 'cat-1',
  storeId: STORE_ID,
  name: 'Pizzas',
  order: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.resetAllMocks())

// ─── listCategories ───────────────────────────────────────────────────────────

describe('listCategories', () => {
  it('returns categories ordered by order asc and name asc', async () => {
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory])

    const result = await listCategories(STORE_ID)

    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pizzas')
  })
})

// ─── createCategory ───────────────────────────────────────────────────────────

describe('createCategory', () => {
  it('creates category, invalidates cache and records audit log', async () => {
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.category.create as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createCategory(STORE_ID, { name: 'Pizzas', order: 0 }, USER_ID)

    expect(result.id).toBe('cat-1')
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'category.create',
          entity: 'Category',
          entityId: 'cat-1',
        }),
      })
    )
  })

  it('throws 422 when name already exists in the store (nome único por storeId)', async () => {
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory)

    await expect(
      createCategory(STORE_ID, { name: 'Pizzas', order: 0 }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })

  it('does not invalidate cache when creation fails', async () => {
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory)

    await expect(
      createCategory(STORE_ID, { name: 'Pizzas', order: 0 }, USER_ID)
    ).rejects.toThrow()

    expect(mockCache.del).not.toHaveBeenCalled()
  })
})

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('updateCategory', () => {
  it('updates category and invalidates cache', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.category.update as jest.Mock).mockResolvedValue({ ...mockCategory, name: 'Lanches' })
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateCategory(STORE_ID, 'cat-1', { name: 'Lanches' }, USER_ID)

    expect(result.name).toBe('Lanches')
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })

  it('updates isActive (soft toggle) without name change', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.category.update as jest.Mock).mockResolvedValue({ ...mockCategory, isActive: false })
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateCategory(STORE_ID, 'cat-1', { isActive: false }, USER_ID)

    expect(result.isActive).toBe(false)
    // no name check should happen
    expect(mockPrisma.category.findFirst).not.toHaveBeenCalled()
  })

  it('throws 404 when category does not exist', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateCategory(STORE_ID, 'cat-99', { name: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 when category belongs to a different store (admin de outra loja não acessa)', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue({
      ...mockCategory,
      storeId: 'other-store',
    })

    await expect(
      updateCategory(STORE_ID, 'cat-1', { name: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when new name conflicts with another category in the same store', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.category.findFirst as jest.Mock).mockResolvedValue({
      ...mockCategory,
      id: 'cat-2',
      name: 'Lanches',
    })

    await expect(
      updateCategory(STORE_ID, 'cat-1', { name: 'Lanches' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe('deleteCategory', () => {
  it('deletes category and invalidates cache', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.category.delete as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await deleteCategory(STORE_ID, 'cat-1', USER_ID)

    expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })

  it('throws 404 when category does not exist', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteCategory(STORE_ID, 'cat-99', USER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 when category belongs to a different store', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue({
      ...mockCategory,
      storeId: 'other-store',
    })

    await expect(deleteCategory(STORE_ID, 'cat-1', USER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when category still has products (FK guard)', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.count as jest.Mock).mockResolvedValue(3)

    await expect(deleteCategory(STORE_ID, 'cat-1', USER_ID)).rejects.toMatchObject({ status: 422 })
    expect(mockPrisma.category.delete).not.toHaveBeenCalled()
  })
})
