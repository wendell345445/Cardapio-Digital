import { NextFunction, Request, Response } from 'express'
import QRCode from 'qrcode'

import { logger } from '../../shared/logger/logger'

import { getQueueCounters } from './whatsapp.queue'
import { connectWhatsApp, disconnectWhatsApp, getQrCode, hasInstance, isConnected, isReconnecting } from './whatsapp.service'

// ─── TASK-070: WhatsApp Admin Endpoints ──────────────────────────────────────

export async function getQrCodeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { storeId } = req.tenant!
    // Inicia conexão apenas se ainda não existe instância
    if (!hasInstance(storeId)) {
      await connectWhatsApp(storeId)
    }
    const qr = getQrCode(storeId)
    const connected = isConnected(storeId)
    logger.info(
      { storeId, hasInstance: hasInstance(storeId), hasQR: !!qr, connected },
      '[WhatsApp] GET qrcode'
    )

    // Converte QR string para data URL base64 (evita dependência de serviço externo)
    let qrCodeDataUrl: string | null = null
    if (qr) {
      qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
    }

    const reconnecting = !connected && isReconnecting(storeId)
    res.json({ success: true, data: { qrCode: qrCodeDataUrl, isConnected: connected, isReconnecting: reconnecting } })
  } catch (err) {
    next(err)
  }
}

export async function disconnectController(req: Request, res: Response, next: NextFunction) {
  try {
    const { storeId } = req.tenant!
    await disconnectWhatsApp(storeId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

/**
 * Retorna o estado da conexão + contadores da fila de envio.
 * Útil pra painel admin acompanhar saúde do WhatsApp sem depender de reclamação de cliente.
 */
export async function getHealthController(req: Request, res: Response, next: NextFunction) {
  try {
    const { storeId } = req.tenant!
    const connected = isConnected(storeId)
    const reconnecting = !connected && isReconnecting(storeId)
    const queue = await getQueueCounters()
    res.json({
      success: true,
      data: {
        storeId,
        isConnected: connected,
        isReconnecting: reconnecting,
        hasInstance: hasInstance(storeId),
        queue,
      },
    })
  } catch (err) {
    next(err)
  }
}
