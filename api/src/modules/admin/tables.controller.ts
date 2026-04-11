import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { createTableSchema, closeTableSchema, updateItemStatusSchema } from './tables.schema'
import {
  listTables,
  createTable,
  generateQRCode,
  generateQRCodePDF,
  closeTable,
  getTableComanda,
  updateOrderItemStatus,
} from './tables.service'

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listTablesController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const result = await listTables(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function createTableController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const data = createTableSchema.parse(req.body)
    const result = await createTable(storeId, data, userId, req.ip)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getQRCodeController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const result = await generateQRCode(storeId, id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getQRCodePDFController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const buffer = await generateQRCodePDF(storeId, id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="mesa-qrcode-${id}.pdf"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function closeTableController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const data = closeTableSchema.parse(req.body)
    const result = await closeTable(storeId, id, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getComandaController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const result = await getTableComanda(storeId, id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateItemStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { tableId, itemId } = req.params
    const data = updateItemStatusSchema.parse(req.body)
    const result = await updateOrderItemStatus(storeId, tableId, itemId, data, userId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
