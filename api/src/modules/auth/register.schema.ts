import { z } from 'zod'

export const STORE_SEGMENTS = [
  'RESTAURANT',
  'PIZZERIA',
  'BURGER',
  'BAKERY',
  'ACAI',
  'JAPANESE',
  'MARKET',
  'OTHER',
] as const

export const STORE_PLANS = ['PROFESSIONAL', 'PREMIUM'] as const

/**
 * Schema Zod do payload de POST /api/v1/auth/register-store.
 * 12 campos + refine de senha. Usado pelo controller e pelos testes.
 */
export const registerStoreSchema = z
  .object({
    storeName: z
      .string()
      .min(2, 'Nome da loja deve ter ao menos 2 caracteres')
      .max(100, 'Nome da loja deve ter no máximo 100 caracteres'),
    segment: z.enum(STORE_SEGMENTS, {
      errorMap: () => ({ message: 'Segmento inválido' }),
    }),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirmação de senha deve ter ao menos 8 caracteres'),
    whatsapp: z
      .string()
      .regex(/^\d{11}$/, 'WhatsApp deve conter 11 dígitos (DDD + número)'),
    // Endereco da loja e configurado depois em Entregas (Places autocomplete +
    // mapa). Cadastro nao pede endereco pra reduzir atrito de conversao.
    plan: z
      .enum(STORE_PLANS, { errorMap: () => ({ message: 'Plano inválido' }) })
      .default('PROFESSIONAL'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type RegisterStoreInput = z.infer<typeof registerStoreSchema>
