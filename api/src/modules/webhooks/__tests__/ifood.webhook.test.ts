// ─── Webhook iFood ────────────────────────────────────────────────────────────
// Cobre: validação HMAC-SHA256 real (assinatura válida/inválida/ausente), body
// malformado, resolução de loja por merchantId, lista de eventos e ACK sempre 200.
// A assinatura é gerada de verdade (não mockada) com IFOOD_CLIENT_SECRET.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: { store: { findFirst: jest.fn() } },
}))

jest.mock('../../ifood/ingest.service', () => ({
  processIFoodEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../shared/logger/logger', () => ({
  asaasLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import crypto from 'node:crypto'

import type { Request, Response } from 'express'

import { prisma } from '../../../shared/prisma/prisma'
import { processIFoodEvent } from '../../ifood/ingest.service'
import { ifoodWebhookController } from '../ifood.webhook'

const SECRET = 'test-client-secret'

function sign(rawBody: Buffer): string {
  return crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex')
}

function mockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

// A rota usa express.raw → req.body é Buffer. Aqui simulamos isso: serializa o
// payload, assina, e passa o Buffer + assinatura no header.
function mockReq(payload: unknown, opts: { signature?: string; rawOverride?: Buffer } = {}): Request {
  const raw = opts.rawOverride ?? Buffer.from(JSON.stringify(payload))
  const signature = 'signature' in opts ? opts.signature : sign(raw)
  return {
    headers: signature === undefined ? {} : { 'x-ifood-signature': signature },
    body: raw,
  } as unknown as Request
}

const next = jest.fn()

describe('ifoodWebhookController', () => {
  const OLD_ENV = process.env.IFOOD_CLIENT_SECRET

  beforeEach(() => {
    jest.resetAllMocks()
    process.env.IFOOD_CLIENT_SECRET = SECRET
    ;(processIFoodEvent as jest.Mock).mockResolvedValue(undefined)
  })

  afterAll(() => {
    process.env.IFOOD_CLIENT_SECRET = OLD_ENV
  })

  it('assinatura inválida → 401 (antes de qualquer processamento)', async () => {
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1' }, { signature: 'deadbeef' }), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(processIFoodEvent).not.toHaveBeenCalled()
  })

  it('assinatura ausente → 401', async () => {
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1' }, { signature: undefined }), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(processIFoodEvent).not.toHaveBeenCalled()
  })

  it('body vazio (Buffer 0) → 401', async () => {
    const res = mockRes()
    const raw = Buffer.alloc(0)

    await ifoodWebhookController(mockReq(null, { rawOverride: raw, signature: sign(raw) }), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('assinatura válida mas body malformado (não-JSON) → 400', async () => {
    const res = mockRes()
    const raw = Buffer.from('{ not json ')

    await ifoodWebhookController(mockReq(null, { rawOverride: raw, signature: sign(raw) }), res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(processIFoodEvent).not.toHaveBeenCalled()
  })

  it('assinatura válida → resolve loja por merchantId e processa (200)', async () => {
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 'store-1', autoConfirmOrders: false })
    const res = mockRes()

    await ifoodWebhookController(
      mockReq({ id: 'ev-1', merchantId: 'mm-1', orderId: 'if-1', code: 'PLACED' }),
      res,
      next
    )

    expect(prisma.store.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ifoodMerchantId: 'mm-1' } })
    )
    expect(processIFoodEvent).toHaveBeenCalledWith(
      { id: 'store-1', autoConfirmOrders: false },
      expect.objectContaining({ id: 'ev-1' })
    )
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('merchant desconhecido → não processa, mas responde 200', async () => {
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue(null)
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1', merchantId: 'xxx', code: 'PLACED' }), res, next)

    expect(processIFoodEvent).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('aceita lista de eventos', async () => {
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 'store-1', autoConfirmOrders: true })
    const res = mockRes()

    await ifoodWebhookController(
      mockReq([
        { id: 'ev-1', merchantId: 'mm-1', code: 'PLACED', orderId: 'a' },
        { id: 'ev-2', merchantId: 'mm-1', code: 'CONFIRMED', orderId: 'a' },
      ]),
      res,
      next
    )

    expect(processIFoodEvent).toHaveBeenCalledTimes(2)
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('erro no processamento não derruba a resposta (sempre 200)', async () => {
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 'store-1', autoConfirmOrders: false })
    ;(processIFoodEvent as jest.Mock).mockRejectedValue(new Error('boom'))
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1', merchantId: 'mm-1', code: 'PLACED' }), res, next)

    expect(res.json).toHaveBeenCalledWith({ received: true })
  })
})
