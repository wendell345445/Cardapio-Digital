import { z } from 'zod'

// Schemas da área de entrega: só por distância.

export const createDistanceSchema = z.object({
  minKm: z.number().nonnegative(),
  maxKm: z.number().positive(),
  fee: z.number().nonnegative(),
})

export const updateDistanceSchema = createDistanceSchema.partial()

export const setStoreCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  addressLabel: z.string().max(500).optional().nullable(),
})

export const calculateDeliverySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const geocodeAddressSchema = z.object({
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

export type CreateDistanceInput = z.infer<typeof createDistanceSchema>
export type UpdateDistanceInput = z.infer<typeof updateDistanceSchema>
export type SetStoreCoordinatesInput = z.infer<typeof setStoreCoordinatesSchema>
export type CalculateDeliveryInput = z.infer<typeof calculateDeliverySchema>
export type GeocodeAddressInput = z.infer<typeof geocodeAddressSchema>
