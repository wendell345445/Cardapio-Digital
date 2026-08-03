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
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  cancelOrder,
  confirmOrder,
  dispatchOrder,
  getCancellationReasons,
} from '../../../shared/ifood/ifood.service'
import { reflectStatusToIFood } from '../actions.service'

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
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      ifoodOrderId: 'if-1',
      storeId: 'store-1',
    })

    await reflectStatusToIFood('store-1', 'order-1', 'CONFIRMED')

    expect(confirmOrder).toHaveBeenCalledWith('if-1')
  })

  it('DISPATCHED → dispatchOrder', async () => {
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      ifoodOrderId: 'if-1',
      storeId: 'store-1',
    })

    await reflectStatusToIFood('store-1', 'order-1', 'DISPATCHED')

    expect(dispatchOrder).toHaveBeenCalledWith('if-1')
  })

  it('CANCELLED busca motivo e cancela', async () => {
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      ifoodOrderId: 'if-1',
      storeId: 'store-1',
    })
    ;(getCancellationReasons as jest.Mock).mockResolvedValue([
      { cancelCodeId: '501', description: 'Problema no restaurante' },
    ])

    await reflectStatusToIFood('store-1', 'order-1', 'CANCELLED')

    expect(cancelOrder).toHaveBeenCalledWith('if-1', '501', 'Problema no restaurante')
  })

  it('erro "already confirmed" é tratado como sucesso (idempotente)', async () => {
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      ifoodOrderId: 'if-1',
      storeId: 'store-1',
    })
    ;(confirmOrder as jest.Mock).mockRejectedValue(new Error('Order already CONFIRMED'))

    // não deve lançar
    await expect(reflectStatusToIFood('store-1', 'order-1', 'CONFIRMED')).resolves.toBeUndefined()
  })

  it('PREPARING/READY não têm ação direta no iFood', async () => {
    ;(prisma.iFoodOrderMap.findUnique as jest.Mock).mockResolvedValue({
      ifoodOrderId: 'if-1',
      storeId: 'store-1',
    })

    await reflectStatusToIFood('store-1', 'order-1', 'PREPARING')

    expect(confirmOrder).not.toHaveBeenCalled()
    expect(dispatchOrder).not.toHaveBeenCalled()
  })
})
