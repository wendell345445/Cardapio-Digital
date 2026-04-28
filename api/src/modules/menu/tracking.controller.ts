import { NextFunction, Request, Response } from 'express'
import { verify } from 'jsonwebtoken'

import { prisma } from '../../shared/prisma/prisma'
import { AppError } from '../../shared/middleware/error.middleware'

export async function getOrderTrackingController(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params
    let payload: { orderId: string; storeId: string }
    try {
      payload = verify(token, process.env.JWT_SECRET!) as { orderId: string; storeId: string }
    } catch {
      throw new AppError('Link de acompanhamento inválido ou expirado', 401)
    }

    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        items: { include: { additionals: true } },
        motoboy: { select: { name: true, whatsapp: true } },
        store: { select: { slug: true, name: true, phone: true } },
        table: { select: { number: true } },
      },
    })

    if (!order || order.storeId !== payload.storeId) {
      throw new AppError('Pedido não encontrado', 404)
    }

    res.json({ success: true, data: order })
  } catch (err) {
    next(err)
  }
}
