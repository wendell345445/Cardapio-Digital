import { NextFunction, Request, Response } from 'express'

import { geocodeAddress } from '../menu/geocoding.service'

import {
  calculateDeliverySchema,
  createDistanceSchema,
  geocodeAddressSchema,
  setStoreCoordinatesSchema,
  updateDistanceSchema,
} from './delivery.schema'
import {
  calculateDeliveryFee,
  createDistance,
  deleteDistance,
  getDeliveryConfig,
  listDistances,
  setStoreCoordinates,
  updateDistance,
} from './delivery.service'

// Controllers da área de entrega admin (só distância).

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

export async function setStoreCoordinatesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const input = setStoreCoordinatesSchema.parse(req.body)
    const result = await setStoreCoordinates(storeId, input)
    res.json({ success: true, data: result })
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

// ── Geocode (admin: busca endereço → lat/lng) ────────────────────────────────

export async function geocodeAddressController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = geocodeAddressSchema.parse(req.body)
    const result = await geocodeAddress(input)
    res.json({ success: true, data: result })
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
