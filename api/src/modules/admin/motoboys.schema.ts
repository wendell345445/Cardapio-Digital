import { z } from 'zod'

export const createMotoboySchema = z.object({
  name: z.string().min(2).max(100),
  whatsapp: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(72),
})

export type CreateMotoboyInput = z.infer<typeof createMotoboySchema>

export const updateMotoboySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  whatsapp: z.string().min(10).max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  password: z.string().min(6).max(72).optional(),
})

export type UpdateMotoboyInput = z.infer<typeof updateMotoboySchema>

export const setMotoboyAvailabilitySchema = z.object({
  available: z.boolean(),
})

export type SetMotoboyAvailabilityInput = z.infer<typeof setMotoboyAvailabilitySchema>
