import { z } from 'zod'

// ─── TASK-041: Produtos CRUD Individual ──────────────────────────────────────

export const variationSchema = z.object({
  id: z.string().uuid().optional(), // opcional para update
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  isActive: z.boolean().optional().default(true),
})

// v2.9: adicionais saíram do produto. Cadastro via /admin/addons (Addon/AddonCategory);
// vínculo produto↔addon via PUT /admin/products/:id/addons. Schema fica enxuto.

// Aceita URL absoluta (Cloudinary/prod) OU caminho local `/uploads/...` (dev fallback).
// Foto é opcional — quando ausente, o cardápio público renderiza um placeholder.
const imageUrlSchema = z
  .string()
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith('/uploads/'),
    { message: 'imageUrl deve ser uma URL absoluta ou caminho /uploads/...' }
  )
  .optional()

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: imageUrlSchema,
  basePrice: z.number().positive().optional(),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional().default(0),
  variations: z.array(variationSchema).optional().default([]),
})

export const updateProductSchema = createProductSchema.partial().extend({
  imageUrl: imageUrlSchema,
})

export const listProductsSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ListProductsInput = z.infer<typeof listProductsSchema>
