// ─── Comanda pública do cliente — Controllers ────────────────────────────────
// Auth via TableSession token (passa em ?token=... ou body.token). Quem tem o
// token tem acesso à comanda — vários celulares na mesma sessão compartilham o
// mesmo token e veem a mesma comanda.

import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { prisma } from '../../shared/prisma/prisma'

import { getCustomerComandaBySession, requestTableCheckBySession } from './comanda.service'

const getComandaQuerySchema = z.object({
  token: z.string().min(20),
})

const requestCheckSchema = z.object({
  token: z.string().min(20),
})

export async function getCustomerComandaController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { token } = getComandaQuerySchema.parse(req.query)
    const data = await getCustomerComandaBySession(storeId, token)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function requestCheckController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { token } = requestCheckSchema.parse(req.body)

    // Pega último whatsapp informado em algum pedido da sessão, se existir
    const session = await prisma.tableSession.findUnique({ where: { token } })
    let clientWhatsapp: string | null = null
    if (session) {
      const lastOrder = await prisma.order.findFirst({
        where: { tableSessionId: session.id },
        orderBy: { createdAt: 'desc' },
        select: { clientWhatsapp: true },
      })
      clientWhatsapp = lastOrder?.clientWhatsapp ?? null
    }

    await requestTableCheckBySession(storeId, token, clientWhatsapp)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
