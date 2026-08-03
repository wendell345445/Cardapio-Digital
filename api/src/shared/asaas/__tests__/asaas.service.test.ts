/**
 * Unit tests — asaas.service.ts (wrapper HTTP do Asaas)
 * Mocka o axios pra validar montagem de request e o verify do webhook token.
 */

const mockPost = jest.fn()
const mockGet = jest.fn()

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ post: mockPost, get: mockGet, delete: jest.fn(), put: jest.fn() }),
  },
  isAxiosError: () => false,
}))

import {
  createCustomer,
  createPixAutoAuthorization,
  createRecurrentCheckout,
  verifyWebhookToken,
} from '../asaas.service'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('createCustomer', () => {
  it('POST /customers com nome/email', async () => {
    mockPost.mockResolvedValue({ data: { id: 'cus_1', name: 'Loja', email: 'a@b.com', cpfCnpj: null } })
    const res = await createCustomer({ name: 'Loja', email: 'a@b.com' })
    expect(mockPost).toHaveBeenCalledWith('/customers', expect.objectContaining({ name: 'Loja', email: 'a@b.com' }))
    expect(res.id).toBe('cus_1')
  })
})

describe('createRecurrentCheckout', () => {
  it('POST /checkouts recorrente por cartão com externalReference = storeId', async () => {
    mockPost.mockResolvedValue({ data: { id: 'chk_1', link: 'https://asaas/checkout', status: 'ACTIVE' } })
    const res = await createRecurrentCheckout({
      storeId: 'store-1',
      value: 99,
      planName: 'Profissional',
      customerData: { name: 'Loja' },
      nextDueDate: '2026-08-10',
      callbackUrls: { successUrl: 's', cancelUrl: 'c', expiredUrl: 'e' },
    })
    const [url, body] = mockPost.mock.calls[0]
    expect(url).toBe('/checkouts')
    expect(body.billingTypes).toEqual(['CREDIT_CARD'])
    expect(body.chargeTypes).toEqual(['RECURRENT'])
    expect(body.subscription).toMatchObject({ cycle: 'MONTHLY', nextDueDate: '2026-08-10' })
    expect(body.externalReference).toBe('store-1')
    expect(res.link).toBe('https://asaas/checkout')
  })
})

describe('createPixAutoAuthorization', () => {
  it('POST /pixAutomaticAuthorization com contractId = storeId e frequência MONTHLY', async () => {
    mockPost.mockResolvedValue({
      data: { id: 'auth_1', status: 'CREATED', payload: 'copia-cola', encodedImage: 'base64==' },
    })
    const res = await createPixAutoAuthorization({
      storeId: 'store-1',
      customerId: 'cus_1',
      value: 149,
      startDate: '2026-08-10',
      description: 'Assinatura Premium',
    })
    const [url, body] = mockPost.mock.calls[0]
    expect(url).toBe('/pix/automatic/authorizations')
    expect(body.contractId).toBe('store-1')
    expect(body.frequency).toBe('MONTHLY')
    expect(body.value).toBe(149)
    expect(body.immediateQrCode.originalValue).toBe(149)
    expect(res.payload).toBe('copia-cola')
    expect(res.encodedImage).toBe('base64==')
  })
})

describe('verifyWebhookToken', () => {
  const OLD = process.env.ASAAS_WEBHOOK_TOKEN
  afterAll(() => {
    process.env.ASAAS_WEBHOOK_TOKEN = OLD
  })

  it('true quando o token bate', () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret'
    expect(verifyWebhookToken('secret')).toBe(true)
  })

  it('false quando difere ou está vazio', () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'secret'
    expect(verifyWebhookToken('outro')).toBe(false)
    expect(verifyWebhookToken(undefined)).toBe(false)
    process.env.ASAAS_WEBHOOK_TOKEN = ''
    expect(verifyWebhookToken('')).toBe(false)
  })
})
