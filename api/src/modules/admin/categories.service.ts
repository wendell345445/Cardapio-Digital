import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'

import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema'

// ─── TASK-040: Categorias CRUD ────────────────────────────────────────────────

export async function listCategories(storeId: string) {
  return prisma.category.findMany({
    where: { storeId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
}

export async function createCategory(
  storeId: string,
  data: CreateCategoryInput,
  userId: string,
  ip?: string
) {
  const existing = await prisma.category.findFirst({
    where: { storeId, name: data.name },
  })
  if (existing) {
    throw new AppError('Já existe uma categoria com esse nome', 422)
  }

  const category = await prisma.category.create({
    data: {
      storeId,
      name: data.name,
      order: data.order,
    },
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'category.create',
      entity: 'Category',
      entityId: category.id,
      data: { name: data.name, order: data.order },
      ip,
    },
  })

  return category
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  data: UpdateCategoryInput,
  userId: string,
  ip?: string
) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })

  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria não encontrada', 404)
  }

  if (data.name && data.name !== category.name) {
    const existing = await prisma.category.findFirst({
      where: { storeId, name: data.name, id: { not: categoryId } },
    })
    if (existing) {
      throw new AppError('Já existe uma categoria com esse nome', 422)
    }
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'category.update',
      entity: 'Category',
      entityId: categoryId,
      data,
      ip,
    },
  })

  return updated
}

export async function deleteCategory(
  storeId: string,
  categoryId: string,
  userId: string,
  ip?: string
) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })

  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria não encontrada', 404)
  }

  await prisma.category.delete({ where: { id: categoryId } })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'category.delete',
      entity: 'Category',
      entityId: categoryId,
      data: { name: category.name },
      ip,
    },
  })
}
