import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

// ─── TASK-109: Adicionais centralizados ──────────────────────────────────────
// Agrupa ProductAdditional por produto para gestão centralizada na sidebar

const router = Router()

router.use(
  authMiddleware,
  requireRole('ADMIN', 'OWNER'),
  extractStoreId,
  requireStore,
  requireActiveStore
)

/**
 * GET /admin/additionals
 * Lista todos os produtos com seus adicionais agrupados
 */
router.get('/', async (req, res, next) => {
  try {
    const storeId = req.tenant!.storeId

    const products = await prisma.product.findMany({
      where: { storeId },
      include: {
        additionals: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const groups = products
      .filter((p) => p.additionals.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category.name,
        isActive: p.isActive,
        items: p.additionals.map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          isActive: a.isActive,
          productId: a.productId,
        })),
      }))

    res.json({ success: true, data: groups })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /admin/additionals/items/:itemId
 * Atualiza um adicional (nome, preço, isActive)
 */
router.patch('/items/:itemId', async (req, res, next) => {
  try {
    const storeId = req.tenant!.storeId
    const { itemId } = req.params
    const { name, price, isActive } = req.body

    // Verify that the additional belongs to this store
    const existing = await prisma.productAdditional.findFirst({
      where: { id: itemId, product: { storeId } },
    })
    if (!existing) {
      res.status(404).json({ success: false, message: 'Adicional não encontrado' })
      return
    }

    const updated = await prisma.productAdditional.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)

    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/additionals/:productId/items
 * Cria um novo adicional em um produto
 */
router.post('/:productId/items', async (req, res, next) => {
  try {
    const storeId = req.tenant!.storeId
    const { productId } = req.params
    const { name, price } = req.body

    if (!name || price === undefined) {
      res.status(400).json({ success: false, message: 'name e price são obrigatórios' })
      return
    }

    const product = await prisma.product.findFirst({ where: { id: productId, storeId } })
    if (!product) {
      res.status(404).json({ success: false, message: 'Produto não encontrado' })
      return
    }

    const item = await prisma.productAdditional.create({
      data: { productId, name, price: Number(price) },
    })

    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)

    res.status(201).json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /admin/additionals/items/:itemId
 */
router.delete('/items/:itemId', async (req, res, next) => {
  try {
    const storeId = req.tenant!.storeId
    const { itemId } = req.params

    const existing = await prisma.productAdditional.findFirst({
      where: { id: itemId, product: { storeId } },
    })
    if (!existing) {
      res.status(404).json({ success: false, message: 'Adicional não encontrado' })
      return
    }

    await prisma.productAdditional.delete({ where: { id: itemId } })

    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

export default router
