import { z } from 'zod'

// ─── Customer: schemas de edição do perfil do cliente no ranking ─────────────

// CEP: 8 dígitos (aceita com ou sem hífen "12345-678" / "12345678").
const cepSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (formato esperado: 12345-678)')
  .transform((v) => v.replace(/\D/g, ''))

// Telefone: só dígitos, 10–13 caracteres (fixo/celular com ou sem DDI).
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido')

export const addressInputSchema = z.object({
  id: z.string().uuid().optional(),
  isPrimary: z.boolean().optional(),
  zipCode: cepSchema,
  street: z.string().trim().min(1, 'Rua obrigatória').max(200),
  number: z.string().trim().min(1, 'Número obrigatório').max(20),
  complement: z.string().trim().max(200).optional().nullable(),
  neighborhood: z.string().trim().min(1, 'Bairro obrigatório').max(120),
  city: z.string().trim().min(1, 'Cidade obrigatória').max(120),
  state: z.string().trim().length(2, 'UF deve ter 2 letras').toUpperCase(),
  reference: z.string().trim().max(200).optional().nullable(),
})

export const phoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  isPrimary: z.boolean().optional(),
  phone: phoneSchema,
  label: z.string().trim().max(40).optional().nullable(),
})

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(120),
  primaryPhone: phoneSchema,
  addresses: z.array(addressInputSchema).min(1, 'Pelo menos 1 endereço obrigatório'),
  secondaryPhones: z.array(phoneInputSchema).default([]),
})

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type AddressInput = z.infer<typeof addressInputSchema>
export type PhoneInput = z.infer<typeof phoneInputSchema>
