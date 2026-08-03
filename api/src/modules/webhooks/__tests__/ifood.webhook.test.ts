// ─── Webhook iFood ────────────────────────────────────────────────────────────
// Cobre: valida secret, resolve loja por merchantId, sempre responde 200,
// e ignora eventos de merchant desconhecido.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: { store: { findFirst: jest.fn() } },
}))

jest.mock('../../../shared/ifood/ifood.service', () => ({
  verifyWebhookSecret: jest.fn(),
}))

jest.mock('../../ifood/ingest.service', () => ({
  processIFoodEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../shared/logger/logger', () => ({
  asaasLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import type { Request, Response } from 'express'

import { prisma } from '../../../shared/prisma/prisma'
import { verifyWebhookSecret } from '../../../shared/ifood/ifood.service'
import { processIFoodEvent } from '../../ifood/ingest.service'
import { ifoodWebhookController } from '../ifood.webhook'

function mockRes() {
  const res = {} as Response
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function mockReq(body: unknown, secret = 'ok'): Request {
  return { headers: { 'x-ifood-signature': secret }, body } as unknown as Request
}

const next = jest.fn()

describe('ifoodWebhookController', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(processIFoodEvent as jest.Mock).mockResolvedValue(undefined)
  })

  it('secret inválido → 401', async () => {
    ;(verifyWebhookSecret as jest.Mock).mockReturnValue(false)
    const res = mockRes()

    await ifoodWebhookController(mockReq({}, 'wrong'), res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(processIFoodEvent).not.toHaveBeenCalled()
  })

  it('resolve loja por merchantId e processa o evento (200)', async () => {
    ;(verifyWebhookSecret as jest.Mock).mockReturnValue(true)
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
    ;(verifyWebhookSecret as jest.Mock).mockReturnValue(true)
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue(null)
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1', merchantId: 'xxx', code: 'PLACED' }), res, next)

    expect(processIFoodEvent).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ received: true })
  })

  it('aceita lista de eventos', async () => {
    ;(verifyWebhookSecret as jest.Mock).mockReturnValue(true)
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
    ;(verifyWebhookSecret as jest.Mock).mockReturnValue(true)
    ;(prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 'store-1', autoConfirmOrders: false })
    ;(processIFoodEvent as jest.Mock).mockRejectedValue(new Error('boom'))
    const res = mockRes()

    await ifoodWebhookController(mockReq({ id: 'ev-1', merchantId: 'mm-1', code: 'PLACED' }), res, next)

    expect(res.json).toHaveBeenCalledWith({ received: true })
  })
})
