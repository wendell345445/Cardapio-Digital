import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'
import * as geoService from '../menu/geo/geo.service'

import {
  calculateDeliverySchema,
  createDistanceSchema,
  createNeighborhoodSchema,
  geocodeAddressSchema,
  setStoreCoordinatesSchema,
  updateDeliverySettingsSchema,
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
  listAvailableNeighborhoods,
  listDistances,
  listNeighborhoods,
  setStoreCoordinates,
  updateDeliverySettings,
  updateDistance,
  updateNeighborhood,
} from './delivery.service'

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

export async function updateDeliverySettingsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const input = updateDeliverySettingsSchema.parse(req.body)
    const result = await updateDeliverySettings(storeId, input)
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
    const n = await createNeighborhood(storeId, input)
    res.status(201).json({ success: true, data: n })
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
    const n = await updateNeighborhood(storeId, req.params.id, input)
    res.json({ success: true, data: n })
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

// ── Geocode (admin: busca endereço → lat/lng) ────────────────────────────────

export async function geocodeAddressController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = geocodeAddressSchema.parse(req.body)
    const result = await geoService.geocode(input)
    if (!result) throw new AppError('Endereço não encontrado', 422)
    res.json({
      success: true,
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
        displayName: result.displayName,
      },
    })
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

// ── Admin calculate (PDV) — storeId vem do JWT, mesmo cálculo do checkout ──────

export async function calculateDeliveryAdminController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const input = calculateDeliverySchema.parse(req.body)
    const result = await calculateDeliveryFee(storeId, input)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ── Public list of available neighborhoods (used in checkout select) ─────────

export async function listAvailableNeighborhoodsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { storeId } = req.params
    const data = await listAvailableNeighborhoods(storeId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
