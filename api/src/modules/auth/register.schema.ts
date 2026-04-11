import { z } from 'zod'

/**
 * 27 unidades federativas do Brasil — usadas para validar o campo `state`
 * no formulário de auto-cadastro de loja (v2.5+).
 */
export const BR_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

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
    cep: z.string().regex(/^\d{8}$/, 'CEP deve conter 8 dígitos'),
    street: z
      .string()
      .min(2, 'Rua/logradouro deve ter ao menos 2 caracteres')
      .max(120, 'Rua/logradouro deve ter no máximo 120 caracteres'),
    number: z
      .string()
      .min(1, 'Informe o número')
      .max(10, 'Número deve ter no máximo 10 caracteres'),
    neighborhood: z
      .string()
      .min(2, 'Bairro deve ter ao menos 2 caracteres')
      .max(80, 'Bairro deve ter no máximo 80 caracteres'),
    city: z
      .string()
      .min(2, 'Cidade deve ter ao menos 2 caracteres')
      .max(80, 'Cidade deve ter no máximo 80 caracteres'),
    state: z.enum(BR_STATES, {
      errorMap: () => ({ message: 'UF inválida' }),
    }),
    plan: z
      .enum(STORE_PLANS, { errorMap: () => ({ message: 'Plano inválido' }) })
      .default('PROFESSIONAL'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type RegisterStoreInput = z.infer<typeof registerStoreSchema>
