import { z } from 'zod'

export const linkMerchantSchema = z.object({
  merchantId: z.string().min(1, 'merchantId obrigatório'),
})

export type LinkMerchantInput = z.infer<typeof linkMerchantSchema>
