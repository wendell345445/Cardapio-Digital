import { Router } from 'express'

import {
  authMiddleware,
  extractStoreId,
  requireActiveStore,
  requireRole,
  requireStore,
} from '../../shared/middleware/auth.middleware'

import {
  createAddon,
  createAddonCategory,
  createAddonCategorySchema,
  createAddonSchema,
  deleteAddon,
  deleteAddonCategory,
  duplicateAddon,
  listAddonCategories,
  listAddons,
  updateAddon,
  updateAddonCategory,
  updateAddonCategorySchema,
  updateAddonSchema,
} from './addons.service'
import { setProductAddons } from './products.service'

// ─── v2.9: Adicionais (sidebar /admin/adicionais) ────────────────────────────
// Substituiu a rota antiga (TASK-109) que listava ProductAdditional agrupado
// por produto. Agora vivem em Addon/AddonCategory e se ligam ao produto via N:N.

const router = Router()

router.use(
  authMiddleware,
  requireRole('ADMIN', 'OWNER'),
  extractStoreId,
  requireStore,
  requireActiveStore
)

// ── Categorias ──────────────────────────────────────────────────────────────

router.get('/categories', async (req, res, next) => {
  try {
    const data = await listAddonCategories(req.tenant!.storeId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/categories', async (req, res, next) => {
  try {
    const data = createAddonCategorySchema.parse(req.body)
    const created = await createAddonCategory(req.tenant!.storeId, data)
    res.status(201).json({ success: true, data: created })
  } catch (err) { next(err) }
})

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const data = updateAddonCategorySchema.parse(req.body)
    const updated = await updateAddonCategory(req.tenant!.storeId, req.params.id, data)
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await deleteAddonCategory(req.tenant!.storeId, req.params.id)
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── Addons ──────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined
    const data = await listAddons(req.tenant!.storeId, { categoryId })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const data = createAddonSchema.parse(req.body)
    const created = await createAddon(req.tenant!.storeId, data)
    res.status(201).json({ success: true, data: created })
  } catch (err) { next(err) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateAddonSchema.parse(req.body)
    const updated = await updateAddon(req.tenant!.storeId, req.params.id, data)
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteAddon(req.tenant!.storeId, req.params.id)
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const created = await duplicateAddon(req.tenant!.storeId, req.params.id)
    res.status(201).json({ success: true, data: created })
  } catch (err) { next(err) }
})

// ── Vínculo produto ↔ adicionais ────────────────────────────────────────────
// PUT substitui a lista inteira. Order vem do índice do array.

router.put('/products/:productId', async (req, res, next) => {
  try {
    const { addonIds } = req.body as { addonIds?: unknown }
    if (!Array.isArray(addonIds) || addonIds.some((id) => typeof id !== 'string')) {
      res.status(400).json({ success: false, error: 'addonIds deve ser array de string' })
      return
    }
    const updated = await setProductAddons(
      req.tenant!.storeId,
      req.params.productId,
      addonIds as string[]
    )
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

export default router
