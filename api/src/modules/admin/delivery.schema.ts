import { z } from 'zod'

// ─── TASK-091: Schema de Área de Entrega ─────────────────────────────────────

export const createNeighborhoodSchema = z.object({
  name: z.string().min(2).max(100),
  fee: z.number().nonnegative(),
})

export const updateNeighborhoodSchema = createNeighborhoodSchema.partial()

export const createDistanceSchema = z.object({
  minKm: z.number().nonnegative(),
  maxKm: z.number().positive(),
  fee: z.number().nonnegative(),
})

export const updateDistanceSchema = createDistanceSchema.partial()

export const setDeliveryModeSchema = z.object({
  mode: z.enum(['NEIGHBORHOOD', 'DISTANCE']).nullable(),
})

export const setStoreCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const calculateDeliverySchema = z.object({
  neighborhood: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export type CreateNeighborhoodInput = z.infer<typeof createNeighborhoodSchema>
export type UpdateNeighborhoodInput = z.infer<typeof updateNeighborhoodSchema>
export type CreateDistanceInput = z.infer<typeof createDistanceSchema>
export type UpdateDistanceInput = z.infer<typeof updateDistanceSchema>
export type SetDeliveryModeInput = z.infer<typeof setDeliveryModeSchema>
export type SetStoreCoordinatesInput = z.infer<typeof setStoreCoordinatesSchema>
export type CalculateDeliveryInput = z.infer<typeof calculateDeliverySchema>
