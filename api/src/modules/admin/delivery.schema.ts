import { z } from 'zod'

export const createDistanceSchema = z.object({
  maxKm: z.number().positive(),
  fee: z.number().nonnegative(),
  etaMin: z.number().int().nonnegative().default(0),
  isAvailable: z.boolean().default(true),
})

export const updateDistanceSchema = createDistanceSchema.partial()

export const createNeighborhoodSchema = z.object({
  name: z.string().min(1).max(120),
  fee: z.number().nonnegative(),
  etaMin: z.number().int().nonnegative().default(0),
  isAvailable: z.boolean().default(true),
})

export const updateNeighborhoodSchema = createNeighborhoodSchema.partial()

export const updateDeliverySettingsSchema = z.object({
  prepTimeMin: z.number().int().nonnegative().optional(),
  freeDeliveryAboveCents: z.number().int().nonnegative().nullable().optional(),
})

export const setStoreCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  addressLabel: z.string().max(500).optional().nullable(),
})

export const calculateDeliverySchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  neighborhoodId: z.string().uuid().optional(),
  // Opcional: quando enviado, o backend zera `fee` se o subtotal cobre o limite
  // de frete grátis da loja. Sem ele, retorna a taxa bruta (UX antiga). Frontend
  // deveria sempre mandar pra UI ficar coerente com o que o cliente vai pagar.
  subtotalCents: z.number().int().nonnegative().optional(),
}).refine(
  (v) => v.neighborhoodId !== undefined || (v.latitude !== undefined && v.longitude !== undefined),
  { message: 'Informe neighborhoodId ou latitude/longitude' },
)

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
export type CreateNeighborhoodInput = z.infer<typeof createNeighborhoodSchema>
export type UpdateNeighborhoodInput = z.infer<typeof updateNeighborhoodSchema>
export type UpdateDeliverySettingsInput = z.infer<typeof updateDeliverySettingsSchema>
export type SetStoreCoordinatesInput = z.infer<typeof setStoreCoordinatesSchema>
export type CalculateDeliveryInput = z.infer<typeof calculateDeliverySchema>
export type GeocodeAddressInput = z.infer<typeof geocodeAddressSchema>
