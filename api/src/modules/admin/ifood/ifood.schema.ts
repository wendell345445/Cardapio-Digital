import { z } from 'zod'

// O lojista informa o merchantId (UUID) da própria loja, copiado do Portal do
// Parceiro iFood. Validamos o formato UUID pra evitar chamadas inúteis ao iFood.
export const linkMerchantSchema = z.object({
  merchantId: z.string().uuid('Informe um ID de loja iFood válido (UUID)'),
})

export type LinkMerchantInput = z.infer<typeof linkMerchantSchema>
