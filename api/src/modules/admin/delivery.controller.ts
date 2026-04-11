import { NextFunction, Request, Response } from 'express'

import type { JwtPayload } from '../../shared/middleware/auth.middleware'

import {
  calculateDeliverySchema,
  createDistanceSchema,
  createNeighborhoodSchema,
  setDeliveryModeSchema,
  updateDistanceSchema,
  updateNeighborhoodSchema,
} from './delivery.schema'
import {
  calculateDeliveryFee,
  createDistance,
  createNeighborhood,
  deleteDistance,
  deleteNeighborhood,
  getDeliveryConfig,
  listDistances,
  listNeighborhoods,
  setDeliveryMode,
  updateDistance,
  updateNeighborhood,
} from './delivery.service'

// ─── TASK-091: Controllers de Área de Entrega ─────────────────────────────────

function getUser(req: Request): JwtPayload {
  return req.user as unknown as JwtPayload
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getDeliveryConfigController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const config = await getDeliveryConfig(storeId)
    res.json({ success: true, data: config })
  } catch (err) {
    next(err)
  }
}

export async function setDeliveryModeController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const { userId } = getUser(req)
    const input = setDeliveryModeSchema.parse(req.body)
    const result = await setDeliveryMode(storeId, input, userId, req.ip)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ── Neighborhoods ─────────────────────────────────────────────────────────────

export async function listNeighborhoodsController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    res.json({ success: true, data: await listNeighborhoods(storeId) })
  } catch (err) {
    next(err)
  }
}

export async function createNeighborhoodController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const input = createNeighborhoodSchema.parse(req.body)
    const nb = await createNeighborhood(storeId, input)
    res.status(201).json({ success: true, data: nb })
  } catch (err) {
    next(err)
  }
}

export async function updateNeighborhoodController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const input = updateNeighborhoodSchema.parse(req.body)
    const nb = await updateNeighborhood(storeId, req.params.id, input)
    res.json({ success: true, data: nb })
  } catch (err) {
    next(err)
  }
}

export async function deleteNeighborhoodController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    await deleteNeighborhood(storeId, req.params.id)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ── Distances ─────────────────────────────────────────────────────────────────

export async function listDistancesController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    res.json({ success: true, data: await listDistances(storeId) })
  } catch (err) {
    next(err)
  }
}

export async function createDistanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const input = createDistanceSchema.parse(req.body)
    const d = await createDistance(storeId, input)
    res.status(201).json({ success: true, data: d })
  } catch (err) {
    next(err)
  }
}

export async function updateDistanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    const input = updateDistanceSchema.parse(req.body)
    const d = await updateDistance(storeId, req.params.id, input)
    res.json({ success: true, data: d })
  } catch (err) {
    next(err)
  }
}

export async function deleteDistanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const storeId = req.tenant!.storeId
    await deleteDistance(storeId, req.params.id)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ── Public calculate (used from menu routes) ──────────────────────────────────

export async function calculateDeliveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { storeId } = req.params
    const input = calculateDeliverySchema.parse(req.body)
    const result = await calculateDeliveryFee(storeId, input)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
