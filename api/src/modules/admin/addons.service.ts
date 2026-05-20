import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

// ─── v2.9: Addons + AddonCategory ────────────────────────────────────────────

// Aceita URL absoluta OU caminho local `/uploads/...` (igual produto).
const imageUrlSchema = z
  .string()
  .min(1, 'imageUrl obrigatório')
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith('/uploads/'),
    { message: 'imageUrl deve ser uma URL absoluta ou caminho /uploads/...' }
  )

// ─── Schemas ────────────────────────────────────────────────────────────────

export const createAddonCategorySchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
})
export const updateAddonCategorySchema = createAddonCategorySchema.partial()

export const createAddonSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  imageUrl: imageUrlSchema.optional().nullable(),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional().default(0),
})
export const updateAddonSchema = createAddonSchema.partial()

export type CreateAddonCategoryInput = z.infer<typeof createAddonCategorySchema>
export type UpdateAddonCategoryInput = z.infer<typeof updateAddonCategorySchema>
export type CreateAddonInput = z.infer<typeof createAddonSchema>
export type UpdateAddonInput = z.infer<typeof updateAddonSchema>

// ─── Categorias ─────────────────────────────────────────────────────────────

export async function listAddonCategories(storeId: string) {
  return prisma.addonCategory.findMany({
    where: { storeId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      addons: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
  })
}

export async function createAddonCategory(storeId: string, data: CreateAddonCategoryInput) {
  const existing = await prisma.addonCategory.findFirst({
    where: { storeId, name: data.name },
  })
  if (existing) {
    throw new AppError('Já existe uma categoria de adicionais com esse nome', 422)
  }

  const created = await prisma.addonCategory.create({
    data: { storeId, ...data },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  return created
}

export async function updateAddonCategory(
  storeId: string,
  categoryId: string,
  data: UpdateAddonCategoryInput
) {
  const category = await prisma.addonCategory.findUnique({ where: { id: categoryId } })
  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria de adicionais não encontrada', 404)
  }

  if (data.name && data.name !== category.name) {
    const dup = await prisma.addonCategory.findFirst({
      where: { storeId, name: data.name, id: { not: categoryId } },
    })
    if (dup) throw new AppError('Já existe uma categoria de adicionais com esse nome', 422)
  }

  const updated = await prisma.addonCategory.update({
    where: { id: categoryId },
    data,
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  return updated
}

export async function deleteAddonCategory(storeId: string, categoryId: string) {
  const category = await prisma.addonCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { addons: true } } },
  })
  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria de adicionais não encontrada', 404)
  }
  if (category._count.addons > 0) {
    throw new AppError(
      'Categoria possui adicionais cadastrados. Mova ou exclua os itens antes.',
      422
    )
  }

  await prisma.addonCategory.delete({ where: { id: categoryId } })
  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)
}

// ─── Addons ─────────────────────────────────────────────────────────────────

export async function listAddons(storeId: string, filters: { categoryId?: string }) {
  return prisma.addon.findMany({
    where: {
      storeId,
      ...(filters.categoryId && { categoryId: filters.categoryId }),
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { category: true },
  })
}

export async function createAddon(storeId: string, data: CreateAddonInput) {
  const category = await prisma.addonCategory.findUnique({ where: { id: data.categoryId } })
  if (!category || category.storeId !== storeId) {
    throw new AppError('Categoria de adicionais não encontrada', 404)
  }

  const dup = await prisma.addon.findFirst({
    where: { storeId, categoryId: data.categoryId, name: data.name },
  })
  if (dup) throw new AppError('Já existe um adicional com esse nome nessa categoria', 422)

  const { imageUrl, ...rest } = data
  const created = await prisma.addon.create({
    data: { storeId, ...rest, imageUrl: imageUrl ?? null },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  return created
}

export async function updateAddon(storeId: string, addonId: string, data: UpdateAddonInput) {
  const addon = await prisma.addon.findUnique({ where: { id: addonId } })
  if (!addon || addon.storeId !== storeId) {
    throw new AppError('Adicional não encontrado', 404)
  }

  if (data.categoryId && data.categoryId !== addon.categoryId) {
    const target = await prisma.addonCategory.findUnique({ where: { id: data.categoryId } })
    if (!target || target.storeId !== storeId) {
      throw new AppError('Categoria de destino não encontrada', 404)
    }
  }

  if (data.name && data.name !== addon.name) {
    const dup = await prisma.addon.findFirst({
      where: {
        storeId,
        categoryId: data.categoryId ?? addon.categoryId,
        name: data.name,
        id: { not: addonId },
      },
    })
    if (dup) throw new AppError('Já existe um adicional com esse nome nessa categoria', 422)
  }

  const updated = await prisma.addon.update({
    where: { id: addonId },
    data,
    include: { category: true },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  return updated
}

export async function deleteAddon(storeId: string, addonId: string) {
  const addon = await prisma.addon.findUnique({ where: { id: addonId } })
  if (!addon || addon.storeId !== storeId) {
    throw new AppError('Adicional não encontrado', 404)
  }

  // Cascade nas ProductAddon via schema. Pedidos antigos seguem intactos
  // porque OrderItemAdditional é snapshot.
  await prisma.addon.delete({ where: { id: addonId } })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)
}

// ─── Duplicar um adicional ──────────────────────────────────────────────────

export async function duplicateAddon(storeId: string, addonId: string) {
  const source = await prisma.addon.findUnique({ where: { id: addonId } })
  if (!source || source.storeId !== storeId) {
    throw new AppError('Adicional não encontrado', 404)
  }

  let candidate = `${source.name} (Cópia)`
  let suffix = 2
  while (
    await prisma.addon.findFirst({
      where: { storeId, categoryId: source.categoryId, name: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${source.name} (Cópia ${suffix})`
    suffix++
  }

  const created = await prisma.addon.create({
    data: {
      storeId,
      categoryId: source.categoryId,
      name: candidate,
      price: source.price,
      imageUrl: source.imageUrl,
      isActive: source.isActive,
      order: source.order,
    },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)

  return created
}
