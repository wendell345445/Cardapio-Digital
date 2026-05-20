import { z } from 'zod'

export const printerLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

export const markPrintedSchema = z.object({
  orderId: z.string().uuid('orderId inválido'),
})

export type PrinterLoginInput = z.infer<typeof printerLoginSchema>
export type MarkPrintedInput = z.infer<typeof markPrintedSchema>
