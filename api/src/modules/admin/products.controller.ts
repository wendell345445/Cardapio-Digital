import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'
import { AppError } from '../../shared/middleware/error.middleware'

import {
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from './products.schema'
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from './products.service'
import { generateTemplate, importProducts } from './products-import.service'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listProductsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const filters = listProductsSchema.parse(req.query)
    const result = await listProducts(storeId, filters)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getProductController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const result = await getProduct(storeId, id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createProductController(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: reauth required — frontend deve enviar header X-Reauth-Token
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = createProductSchema.parse(req.body)
    const result = await createProduct(storeId, data, userId, req.ip)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateProductController(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: reauth required — frontend deve enviar header X-Reauth-Token
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const data = updateProductSchema.parse(req.body)
    const result = await updateProduct(storeId, id, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function deleteProductController(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: reauth required — frontend deve enviar header X-Reauth-Token
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    await deleteProduct(storeId, id, userId, req.ip)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-043: Importação em Massa CSV/XLSX ───────────────────────────────────

export async function downloadTemplateController(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await generateTemplate()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="template-produtos.xlsx"')
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function importProductsController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Nenhum arquivo enviado', 400)
    const storeId = req.tenant!.storeId
    const result = await importProducts(req.file, storeId, req.user!.userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
