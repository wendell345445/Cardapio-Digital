import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import {
  closeTableSchema,
  confirmTablePaymentSchema,
  createTableSchema,
  settleTableSchema,
  setTablesCountSchema,
  updateItemStatusSchema,
} from './tables.schema'
import {
  closeTable,
  confirmTableSessionPayment,
  createTable,
  generateAllQRCodesPDF,
  generateQRCode,
  generateQRCodePDF,
  getTableComanda,
  listClosedSessions,
  listTables,
  setTablesCount,
  settleTable,
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

export async function setTablesCountController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { count } = setTablesCountSchema.parse(req.body)
    const result = await setTablesCount(storeId, count, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getAllQRCodesPDFController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const buffer = await generateAllQRCodesPDF(storeId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="mesas-qrcodes.pdf"')
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function confirmTablePaymentController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const data = confirmTablePaymentSchema.parse(req.body)
    const result = await confirmTableSessionPayment(storeId, id, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function settleTableController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const data = settleTableSchema.parse(req.body)
    const result = await settleTable(storeId, id, data, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function listClosedSessionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined
    const from = fromRaw ? new Date(fromRaw) : undefined
    const to = toRaw ? new Date(toRaw) : undefined
    const result = await listClosedSessions(storeId, { from, to, limit: 50 })
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
