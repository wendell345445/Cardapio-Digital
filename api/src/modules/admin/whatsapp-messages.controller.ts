import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'

import {
  getWhatsAppMessages,
  updateWhatsAppMessage,
  resetWhatsAppMessage,
  type WhatsAppEventType,
} from './whatsapp-messages.service'

// ─── TASK-097 + TASK-116: WhatsApp Messages Controller ───────────────────────

const updateTemplateSchema = z.object({
  template: z.string().min(1).max(1000),
})

export async function getWhatsAppMessagesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const result = await getWhatsAppMessages(storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function updateWhatsAppMessageController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { eventType } = req.params as { eventType: string }
    const body = updateTemplateSchema.safeParse(req.body)

    if (!body.success) {
      throw new AppError(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
    }

    const updated = await updateWhatsAppMessage(
      storeId,
      eventType as WhatsAppEventType,
      body.data.template
    )

    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

export async function resetWhatsAppMessageController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const storeId = req.tenant!.storeId
    const { eventType } = req.params as { eventType: string }

    await resetWhatsAppMessage(storeId, eventType as WhatsAppEventType)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
