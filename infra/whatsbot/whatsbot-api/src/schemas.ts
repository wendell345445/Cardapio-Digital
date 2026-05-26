import { z } from 'zod'

export const answerSchema = z.object({
  storeId: z.string().uuid(),
  customerPhone: z.string().min(5).max(30),
  message: z.string().min(1).max(2000),
  context: z.object({
    store: z.object({
      name: z.string(),
      slug: z.string().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      menuUrl: z.string().url(),
      isOpenNow: z.boolean().optional(),
      nextOpenLabel: z.string().nullable().optional(),
      openingHours: z.unknown().optional(),
      prepTimeMin: z.number().int().nonnegative().nullable().optional(),
      // Quadro semanal pré-formatado (1 linha por dia). Permite a IA
      // responder perguntas tipo "que horas abrem?" / "abre domingo?".
      businessHours: z.string().nullable().optional(),
    }),
    menu: z.string().optional(),
    menuJson: z.string().optional(),
  }),
})

export type AnswerRequest = z.infer<typeof answerSchema>
export type AnswerContext = AnswerRequest['context']
