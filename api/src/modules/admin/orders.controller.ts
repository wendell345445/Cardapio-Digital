import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import { assignMotoboySchema, listOrdersSchema, updateOrderAddressSchema, updateOrderStatusSchema } from './orders.schema'
import { assignMotoboy, confirmOrderPayment, getOrder, listOrders, updateOrderAddress, updateOrderStatus } from './orders.service'
import { getOrderReceipt } from './print.service'

// ─── TASK-080: Controllers de Pedidos Admin ──────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

export async function listOrdersController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const filters = listOrdersSchema.parse(req.query)
    const result = await listOrders(storeId, filters)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getOrderController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const result = await getOrder(storeId, id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-082: Controller de Atualização de Status ───────────────────────────

export async function updateOrderStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const input = updateOrderStatusSchema.parse(req.body)
    const result = await updateOrderStatus(storeId, id, input, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── A-046: Controller de Atualização de Endereço ───────────────────────────

export async function updateOrderAddressController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const input = updateOrderAddressSchema.parse(req.body)
    const result = await updateOrderAddress(storeId, id, input)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-084/A-050: Controller — Recibo para Impressão ─────────────────────

export async function getOrderReceiptController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { id } = req.params
    const receipt = await getOrderReceipt(storeId, id)
    res.json({ success: true, data: { receipt } })
  } catch (err) {
    next(err)
  }
}

// ─── M-012: Controller — Confirmar Recebimento de Pagamento ─────────────────

export async function confirmPaymentController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const result = await confirmOrderPayment(storeId, id, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── TASK-085: Controller de Atribuição de Motoboy ───────────────────────────

export async function assignMotoboyController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const { id } = req.params
    const input = assignMotoboySchema.parse(req.body)
    const result = await assignMotoboy(storeId, id, input, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
