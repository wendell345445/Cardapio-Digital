import { NextFunction, Request, Response } from 'express'
import QRCode from 'qrcode'

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
    console.log(`[WhatsApp] GET qrcode storeId=${storeId} hasInstance=${hasInstance(storeId)} hasQR=${!!qr} connected=${connected}`)

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
