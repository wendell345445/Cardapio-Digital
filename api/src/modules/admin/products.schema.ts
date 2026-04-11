import { z } from 'zod'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

export const variationSchema = z.object({
  id: z.string().uuid().optional(), // opcional para update
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  isActive: z.boolean().optional().default(true),
})

export const additionalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  isActive: z.boolean().optional().default(true),
})

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url(), // RN-006: foto obrigatória
  basePrice: z.number().positive().optional(),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional().default(0),
  variations: z.array(variationSchema).optional().default([]),
  additionals: z.array(additionalSchema).optional().default([]),
})

export const updateProductSchema = createProductSchema.partial().extend({
  imageUrl: z.string().url().optional(), // não obrigatório em update
})

export const listProductsSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ListProductsInput = z.infer<typeof listProductsSchema>
