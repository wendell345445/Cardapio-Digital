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
    // CPF (11) ou CNPJ (14), só dígitos. Exigido pra cobrança (PIX Automático).
    documentNumber: z
      .string()
      .regex(/^\d{11}$|^\d{14}$/, 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)'),
    // Endereço da loja — obrigatório pra pré-preencher o checkout de cartão do Asaas
    // (que exige postalCode/address/addressNumber/province/city quando identifica o
    // cliente). Coletado com autopreenchimento por CEP (ViaCEP) no cadastro.
    cep: z.string().regex(/^\d{8}$/, 'CEP deve conter 8 dígitos'),
    street: z.string().min(2, 'Informe o logradouro').max(200),
    number: z.string().min(1, 'Informe o número').max(20),
    neighborhood: z.string().min(2, 'Informe o bairro').max(120),
    city: z.string().min(2, 'Informe a cidade').max(120),
    state: z.string().regex(/^[A-Za-z]{2}$/, 'UF deve ter 2 letras'),
    plan: z
      .enum(STORE_PLANS, { errorMap: () => ({ message: 'Plano inválido' }) })
      .default('PROFESSIONAL'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type RegisterStoreInput = z.infer<typeof registerStoreSchema>
