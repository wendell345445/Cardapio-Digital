// ─── TASK-041: Produtos CRUD Individual — Unit Tests ─────────────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    category: { findUnique: jest.fn() },
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productVariation: { deleteMany: jest.fn() },
    productAdditional: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: { del: jest.fn() },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    menuUpdated: jest.fn(),
    itemStatus: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { cache } from '../../../shared/redis/redis'
import { emit } from '../../../shared/socket/socket'
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../products.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>
const mockEmit = emit as jest.Mocked<typeof emit>

const STORE_ID = 'store-1'
const USER_ID = 'user-1'
const CATEGORY_ID = 'cat-1'
const PRODUCT_ID = 'prod-1'

const mockCategory = {
  id: CATEGORY_ID,
  storeId: STORE_ID,
  name: 'Pizzas',
  order: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockProduct = {
  id: PRODUCT_ID,
  storeId: STORE_ID,
  categoryId: CATEGORY_ID,
  name: 'Pizza Margherita',
  description: 'Clássica pizza italiana',
  imageUrl: 'https://cloudinary.com/image.jpg',
  basePrice: 35.9,
  isActive: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  variations: [],
  additionals: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((input) => {
    if (typeof input === 'function') return input(mockPrisma)
    return Promise.all(input)
  })
})

// ─── listProducts ─────────────────────────────────────────────────────────────

describe('listProducts', () => {
  it('lists all products for a store', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])

    const result = await listProducts(STORE_ID, {})

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID } })
    )
    expect(result).toHaveLength(1)
  })

  it('filters by categoryId when provided', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])

    await listProducts(STORE_ID, { categoryId: CATEGORY_ID })

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: CATEGORY_ID }),
      })
    )
  })

  it('filters by search term (name contains, case insensitive)', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct])

    await listProducts(STORE_ID, { search: 'pizza' })

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'pizza', mode: 'insensitive' },
        }),
      })
    )
  })
})

// ─── getProduct ───────────────────────────────────────────────────────────────

describe('getProduct', () => {
  it('returns product with variations and additionals', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)

    const result = await getProduct(STORE_ID, PRODUCT_ID)

    expect(result.id).toBe(PRODUCT_ID)
  })

  it('throws 404 when product not found', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getProduct(STORE_ID, 'nonexistent')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 when product belongs to a different store', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({
      ...mockProduct,
      storeId: 'other-store',
    })

    await expect(getProduct(STORE_ID, PRODUCT_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── createProduct ────────────────────────────────────────────────────────────

describe('createProduct — validateProductName', () => {
  it('throws 422 when product name already exists in the store (nome duplicado → 422)', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct)

    await expect(
      createProduct(
        STORE_ID,
        {
          categoryId: CATEGORY_ID,
          name: 'Pizza Margherita',
          imageUrl: 'https://cloudinary.com/img.jpg',
          order: 0,
          isActive: true,
          variations: [],
          additionals: [],
        },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 422 })
  })

  it('throws 404 when category does not belong to the store', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      createProduct(
        STORE_ID,
        {
          categoryId: 'unknown-cat',
          name: 'Nova Pizza',
          imageUrl: 'https://cloudinary.com/img.jpg',
          order: 0,
          isActive: true,
          variations: [],
          additionals: [],
        },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 404 })
  })

  it('creates product with variations and additionals in a transaction', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.product.create as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createProduct(
      STORE_ID,
      {
        categoryId: CATEGORY_ID,
        name: 'Pizza Margherita',
        imageUrl: 'https://cloudinary.com/img.jpg',
        order: 0,
        isActive: true,
        variations: [{ name: 'Grande', price: 45.9, isActive: true }],
        additionals: [{ name: 'Borda Catupiry', price: 5.0, isActive: true }],
      },
      USER_ID
    )

    expect(result.id).toBe(PRODUCT_ID)
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('invalidates Redis cache and emits socket menu:updated after create', async () => {
    ;(mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.product.create as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await createProduct(
      STORE_ID,
      {
        categoryId: CATEGORY_ID,
        name: 'Pizza Margherita',
        imageUrl: 'https://cloudinary.com/img.jpg',
        order: 0,
        isActive: true,
        variations: [],
        additionals: [],
      },
      USER_ID
    )

    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })
})

// ─── updateProduct ────────────────────────────────────────────────────────────

describe('updateProduct', () => {
  it('throws 404 when product not found', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateProduct(STORE_ID, 'nonexistent', { name: 'Novo Nome' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 422 when new name already exists for another product (nome duplicado → 422)', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({
      ...mockProduct,
      id: 'prod-2',
      name: 'Pizza Calabresa',
    })

    await expect(
      updateProduct(STORE_ID, PRODUCT_ID, { name: 'Pizza Calabresa' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })
  })

  it('invalidates cache and emits socket after update', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, basePrice: 40.0 })
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await updateProduct(STORE_ID, PRODUCT_ID, { basePrice: 40.0 }, USER_ID)

    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })
})

// ─── deleteProduct ────────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  it('deletes product, invalidates cache and emits socket', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.product.delete as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockCache.del as jest.Mock).mockResolvedValue(undefined)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await deleteProduct(STORE_ID, PRODUCT_ID, USER_ID)

    expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } })
    expect(mockCache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
    expect(mockEmit.menuUpdated).toHaveBeenCalledWith(STORE_ID)
  })

  it('throws 404 when product does not exist', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteProduct(STORE_ID, 'nonexistent', USER_ID)).rejects.toMatchObject({
      status: 404,
    })
  })
})
