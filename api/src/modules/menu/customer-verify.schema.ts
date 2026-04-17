import { z } from 'zod'

export const checkCustomerSchema = z.object({
  whatsapp: z.string().length(11, 'WhatsApp deve ter 11 dígitos'),
})

export const requestOtpSchema = z.object({
  whatsapp: z.string().length(11, 'WhatsApp deve ter 11 dígitos'),
})

export const verifyOtpSchema = z.object({
  whatsapp: z.string().length(11, 'WhatsApp deve ter 11 dígitos'),
  code: z.string().length(4, 'Código deve ter 4 dígitos'),
})
