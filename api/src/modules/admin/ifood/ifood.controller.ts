import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../../shared/middleware/error.middleware'
import { applyCatalogImport, previewCatalogImport } from '../../ifood/catalog-import.service'

import { linkMerchantSchema } from './ifood.schema'
import { disconnect, getConnectionStatus, linkMerchant, previewMerchant } from './ifood.service'

function storeId(req: Request): string {
  if (!req.tenant?.storeId) throw new AppError('Store context required', 403)
  return req.tenant.storeId
}

/** GET /admin/ifood/status — estado da conexão iFood da loja. */
export async function statusController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await getConnectionStatus(storeId(req)) })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /admin/ifood/merchant/preview { merchantId } — valida o merchantId informado
 * pelo lojista e devolve os dados da loja pra ele conferir antes de vincular.
 * NÃO lista os merchants de outras lojas (isolamento multi-tenant).
 */
export async function previewMerchantController(req: Request, res: Response, next: NextFunction) {
  try {
    const { merchantId } = linkMerchantSchema.parse(req.body)
    res.json({ success: true, data: await previewMerchant(storeId(req), merchantId) })
  } catch (err) {
    next(err)
  }
}

/** PUT /admin/ifood/merchant { merchantId } — vincula um merchant a esta loja. */
export async function linkController(req: Request, res: Response, next: NextFunction) {
  try {
    const { merchantId } = linkMerchantSchema.parse(req.body)
    const data = await linkMerchant(storeId(req), merchantId, req.user?.userId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

/** DELETE /admin/ifood — desvincula. */
export async function disconnectController(req: Request, res: Response, next: NextFunction) {
  try {
    await disconnect(storeId(req), req.user?.userId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

/** GET /admin/ifood/catalog/preview — o que será importado do catálogo iFood. */
export async function catalogPreviewController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await previewCatalogImport(storeId(req)) })
  } catch (err) {
    next(err)
  }
}

/** POST /admin/ifood/catalog/import — importa o catálogo iFood pra loja. */
export async function catalogImportController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await applyCatalogImport(storeId(req), req.user?.userId) })
  } catch (err) {
    next(err)
  }
}
