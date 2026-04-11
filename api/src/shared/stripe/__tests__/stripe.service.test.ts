// Mock Stripe SDK before importing the service
const subscriptionsCreate = jest.fn()
const customersDel = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      del: customersDel,
    },
    subscriptions: {
      create: subscriptionsCreate,
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.STRIPE_PROFESSIONAL_PRICE_ID = 'price_pro_fake'

import { cancelCustomerSafe, createSubscription } from '../stripe.service'

describe('createSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    subscriptionsCreate.mockResolvedValue({
      id: 'sub_fake',
      status: 'trialing',
      items: { data: [{ id: 'si_1', price: { id: 'price_pro_fake' } }] },
      customer: 'cus_fake',
      trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    })
  })

  it('creates subscription with trial_period_days=7 + allow_incomplete (trial forçado no código)', async () => {
    await createSubscription('cus_fake', 'price_pro_fake')

    expect(subscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_fake',
        items: [{ price: 'price_pro_fake' }],
        trial_period_days: 7,
        payment_behavior: 'allow_incomplete',
      })
    )
  })
})

describe('cancelCustomerSafe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls stripe.customers.del with the provided customerId', async () => {
    customersDel.mockResolvedValue({ id: 'cus_fake', deleted: true })
    await cancelCustomerSafe('cus_fake')
    expect(customersDel).toHaveBeenCalledWith('cus_fake')
  })

  it('does not throw when stripe returns an error (idempotent)', async () => {
    customersDel.mockRejectedValue(new Error('No such customer: cus_inexistente'))
    await expect(cancelCustomerSafe('cus_inexistente')).resolves.toBeUndefined()
  })
})
