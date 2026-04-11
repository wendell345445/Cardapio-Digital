import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  order: z.number().int().min(0).optional().default(0),
})

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
