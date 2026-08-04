// ─── Ações de volta: status local (Kanban) → iFood ───────────────────────────
// Cobre: só age em pedido iFood, mapeamento de status → chamada, e o tratamento
// idempotente de erro "already".

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: { iFoodOrderMap: { findUnique: jest.fn() } },
}))

jest.mock('../../../shared/utils/store-lock', () => ({
  withStoreLock: (_storeId: string, fn: () => Promise<unknown>) => fn(),
}))

jest.mock('../../../shared/ifood/ifood.service', () => ({
  confirmOrder: jest.fn(),
  dispatchOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getCancellationReasons: jest.fn(),
  startPreparationOrder: jest.fn(),
  readyToPickupOrder: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  cancelOrder,
  confirmOrder,
  dispatchOrder,
  getCancellationReasons,
  readyToPickupOrder,
  startPreparationOrder,
} from '../../../shared/ifood/ifood.service'
import { reflectStatusToIFood } from '../actions.service'

// mock do map com type + deliveredBy do pedido (DELIVERY/MERCHANT default)
function mockMap(type: 'DELIVERY' | 'PICKUP' = 'DELIVERY', deliveredBy: string | null = 'MERCHANT') {
  ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
    ifoodOrderId: 'if-1',
    storeId: 'store-1',
    order: { type, ifoodDeliveredBy: deliveredBy },
  })
}

describe('reflectStatusToIFood', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('não faz nada se o pedido não veio do iFood (sem map)', async () => {
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue(null)

    await reflectStatusToIFood('store-1', 'order-1', 'CONFIRMED')

    expect(confirmOrder).not.toHaveBeenCalled()
  })

  it('CONFIRMED → confirmOrder', async () => {
    mockMap()

    await reflectStatusToIFood('store-1', 'order-1', 'CONFIRMED')

    expect(confirmOrder).toHaveBeenCalledWith('if-1')
  })

  it('PREPARING → nenhuma ação (Em preparo é controle interno, não reflete pro iFood)', async () => {
    mockMap('DELIVERY')

    await reflectStatusToIFood('store-1', 'order-1', 'PREPARING')

    expect(startPreparationOrder).not.toHaveBeenCalled()
    expect(dispatchOrder).not.toHaveBeenCalled()
  })

  it('READY (delivery MERCHANT) → readyToPickup (marca pronto)', async () => {
    mockMap('DELIVERY', 'MERCHANT')

    await reflectStatusToIFood('store-1', 'order-1', 'READY')

    expect(readyToPickupOrder).toHaveBeenCalledWith('if-1')
    expect(dispatchOrder).not.toHaveBeenCalled()
  })

  it('READY (retirada) → readyToPickup', async () => {
    mockMap('PICKUP', null)

    await reflectStatusToIFood('store-1', 'order-1', 'READY')

    expect(readyToPickupOrder).toHaveBeenCalledWith('if-1')
  })

  it('DISPATCHED (delivery MERCHANT / entrega própria) → dispatchOrder', async () => {
    mockMap('DELIVERY', 'MERCHANT')

    await reflectStatusToIFood('store-1', 'order-1', 'DISPATCHED')

    expect(dispatchOrder).toHaveBeenCalledWith('if-1')
  })

  it('DISPATCHED (delivery IFOOD / logística iFood) → NÃO despacha (iFood despacha sozinho)', async () => {
    mockMap('DELIVERY', 'IFOOD')

    await reflectStatusToIFood('store-1', 'order-1', 'DISPATCHED')

    expect(dispatchOrder).not.toHaveBeenCalled()
  })

  it('DISPATCHED sem deliveredBy (pedido antigo/NULL) → despacha como MERCHANT (conservador)', async () => {
    mockMap('DELIVERY', null)

    await reflectStatusToIFood('store-1', 'order-1', 'DISPATCHED')

    expect(dispatchOrder).toHaveBeenCalledWith('if-1')
  })

  it('DISPATCHED (retirada) → não despacha', async () => {
    mockMap('PICKUP', null)

    await reflectStatusToIFood('store-1', 'order-1', 'DISPATCHED')

    expect(dispatchOrder).not.toHaveBeenCalled()
  })

  it('CANCELLED busca motivo e cancela', async () => {
    mockMap('DELIVERY')
    ;(getCancellationReasons as jest.Mock).mockResolvedValue([
      { cancelCodeId: '501', description: 'Problema no restaurante' },
    ])

    await reflectStatusToIFood('store-1', 'order-1', 'CANCELLED')

    expect(cancelOrder).toHaveBeenCalledWith('if-1', '501', 'Problema no restaurante')
  })

  it('erro "already confirmed" é tratado como sucesso (idempotente)', async () => {
    mockMap('DELIVERY')
    ;(confirmOrder as jest.Mock).mockRejectedValue(new Error('Order already CONFIRMED'))

    // não deve lançar
    await expect(reflectStatusToIFood('store-1', 'order-1', 'CONFIRMED')).resolves.toBeUndefined()
  })
})
