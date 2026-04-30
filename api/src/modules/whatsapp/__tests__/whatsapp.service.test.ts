// Regressão: bug das mensagens duplicadas (28/04/2026).
// Mesmo número WhatsApp pareado em duas lojas fazia ambas responderem GREETING/IA
// com o nome de loja próprio — cliente via duas saudações com nomes diferentes.
// `evictPriorPairings` desconecta a sessão anterior e atualiza Store.whatsappPairedNumber.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { evictPriorPairings } from '../whatsapp.service'
import { prisma } from '../../../shared/prisma/prisma'

const mockFindMany = prisma.store.findMany as jest.Mock
const mockFindUnique = prisma.store.findUnique as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

describe('evictPriorPairings — proteção contra mesmo número WA em múltiplas lojas', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockFindMany.mockResolvedValue([])
    mockFindUnique.mockResolvedValue({ id: 'store-A' })
    mockTransaction.mockImplementation(async (ops: unknown[]) => ops)
  })

  it('salva o número pareado na loja atual quando não há conflito', async () => {
    mockFindMany.mockResolvedValue([])

    await evictPriorPairings('store-A', '5548999990001:42@s.whatsapp.net')

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { whatsappPairedNumber: '5548999990001', NOT: { id: 'store-A' } },
      select: { id: true, name: true },
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('desconecta loja anterior quando o mesmo número aparece em outra store', async () => {
    mockFindMany.mockResolvedValue([{ id: 'store-B', name: 'burgermais' }])

    await evictPriorPairings('store-A', '5548999990001:42@s.whatsapp.net')

    // updateMany dentro da transação zera pairedNumber de store-B,
    // update seta em store-A. Tudo na transação para não violar unique.
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { whatsappPairedNumber: '5548999990001', NOT: { id: 'store-A' } },
      select: { id: true, name: true },
    })
  })

  it('é tolerante a JID em formato simples (sem ":" device id)', async () => {
    mockFindMany.mockResolvedValue([])

    await evictPriorPairings('store-A', '5548999990001@s.whatsapp.net')

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { whatsappPairedNumber: '5548999990001', NOT: { id: 'store-A' } },
      select: { id: true, name: true },
    })
  })

  it('faz noop quando o JID não tem número extraível', async () => {
    await evictPriorPairings('store-A', '@s.whatsapp.net')

    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  // Regressão: P2025 quando sessão WhatsApp em disco aponta pra storeId já
  // deletado do banco. O update final da transação falhava e fazia rollback
  // do updateMany, deixando outras lojas com pairedNumber preso. Hoje
  // detectamos store ausente antes da transação e abortamos limpo.
  it('faz noop quando a store atual não existe mais no banco (sessão órfã)', async () => {
    mockFindUnique.mockResolvedValue(null)

    await evictPriorPairings('store-deleted', '5548999990001:42@s.whatsapp.net')

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'store-deleted' },
      select: { id: true },
    })
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
