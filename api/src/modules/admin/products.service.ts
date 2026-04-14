import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

import type { CreateProductInput, ListProductsInput, UpdateProductInput } from './products.schema'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

export async function listProducts(storeId: string, filters: ListProductsInput) {
  const where: {
    storeId: string
    categoryId?: string
    isActive?: boolean
    name?: { contains: string; mode: 'insensitive' }
  } = { storeId }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' }
  }

  return prisma.product.findMany({
    where,
    include: {
      variations: true,
      additionals: true,
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
}

export async function getProduct(storeId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variations: true,
      additionals: true,
    },
  })

  if (!product || product.storeId !== storeId) {
    throw new AppError('Produto não encontrado', 404)
  }

  return product
}

export async function createProduct(
  storeId: string,
  data: CreateProductInput,
  userId: string,
  ip?: string
) {
  // Verifica se a categoria pertence à loja
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria não encontrada', 404)
  }

  // Verifica unicidade do nome na loja
  const existing = await prisma.product.findFirst({
    where: { storeId, name: data.name },
  })
  if (existing) {
    throw new AppError('Já existe um produto com esse nome nesta loja', 422)
  }

  const { variations, additionals, ...productData } = data

  // Cria produto com variações e adicionais em transação
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        storeId,
        ...productData,
        variations: {
          create: variations?.map(({ id: _id, ...v }) => v) ?? [],
        },
        additionals: {
          create: additionals?.map(({ id: _id, ...a }) => a) ?? [],
        },
      },
      include: {
        variations: true,
        additionals: true,
      },
    })
    return created
  })

  // Invalida cache e emite socket
  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  // Audit log
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'product.create',
      entity: 'Product',
      entityId: product.id,
      data: { name: data.name, categoryId: data.categoryId },
      ip,
    },
  })

  return product
}

export async function updateProduct(
  storeId: string,
  productId: string,
  data: UpdateProductInput,
  userId: string,
  ip?: string
) {
  // Verifica se o produto pertence à loja
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== storeId) {
    throw new AppError('Produto não encontrado', 404)
  }

  // Se mudou o nome, verifica unicidade
  if (data.name && data.name !== product.name) {
    const existing = await prisma.product.findFirst({
      where: { storeId, name: data.name, id: { not: productId } },
    })
    if (existing) {
      throw new AppError('Já existe um produto com esse nome nesta loja', 422)
    }
  }

  // Se mudou a categoria, verifica se pertence à loja
  if (data.categoryId && data.categoryId !== product.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category || category.storeId !== storeId) {
      throw new AppError('Categoria não encontrada', 404)
    }
  }

  const { variations, additionals, ...productData } = data

  // Atualiza em transação: produto + variações (delete all e recriar) + adicionais (delete all e recriar)
  const updated = await prisma.$transaction(async (tx) => {
    if (variations !== undefined) {
      await tx.productVariation.deleteMany({ where: { productId } })
    }

    if (additionals !== undefined) {
      await tx.productAdditional.deleteMany({ where: { productId } })
    }

    return tx.product.update({
      where: { id: productId },
      data: {
        ...productData,
        ...(variations !== undefined && {
          variations: {
            create: variations.map(({ id: _id, ...v }) => v),
          },
        }),
        ...(additionals !== undefined && {
          additionals: {
            create: additionals.map(({ id: _id, ...a }) => a),
          },
        }),
      },
      include: {
        variations: true,
        additionals: true,
      },
    })
  })

  // Invalida cache e emite socket
  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  // Audit log
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'product.update',
      entity: 'Product',
      entityId: productId,
      data: productData as object,
      ip,
    },
  })

  return updated
}

export async function duplicateProduct(
  storeId: string,
  productId: string,
  userId: string,
  ip?: string
) {
  const source = await prisma.product.findUnique({
    where: { id: productId },
    include: { variations: true, additionals: true },
  })

  if (!source || source.storeId !== storeId) {
    throw new AppError('Produto não encontrado', 404)
  }

  // Gera nome único "X (Cópia)", "X (Cópia 2)", ...
  const baseName = `${source.name} (Cópia)`
  let candidate = baseName
  let suffix = 2
  while (
    await prisma.product.findFirst({ where: { storeId, name: candidate }, select: { id: true } })
  ) {
    candidate = `${baseName} ${suffix}`
    suffix++
  }

  const duplicated = await prisma.$transaction(async (tx) => {
    return tx.product.create({
      data: {
        storeId,
        categoryId: source.categoryId,
        name: candidate,
        description: source.description,
        imageUrl: source.imageUrl,
        basePrice: source.basePrice,
        isActive: source.isActive,
        order: source.order,
        variations: {
          create: source.variations.map((v) => ({
            name: v.name,
            price: v.price,
            isActive: v.isActive,
          })),
        },
        additionals: {
          create: source.additionals.map((a) => ({
            name: a.name,
            price: a.price,
            isActive: a.isActive,
          })),
        },
      },
      include: { variations: true, additionals: true },
    })
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'product.duplicate',
      entity: 'Product',
      entityId: duplicated.id,
      data: { sourceId: productId, name: candidate },
      ip,
    },
  })

  return duplicated
}

export async function deleteProduct(
  storeId: string,
  productId: string,
  userId: string,
  ip?: string
) {
  // Verifica se o produto pertence à loja
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== storeId) {
    throw new AppError('Produto não encontrado', 404)
  }

  // Deleta (cascade deleta variations e additionals via onDelete: Cascade no Prisma)
  await prisma.product.delete({ where: { id: productId } })

  // Invalida cache e emite socket
  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  // Audit log
  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'product.delete',
      entity: 'Product',
      entityId: productId,
      data: { name: product.name },
      ip,
    },
  })
}
