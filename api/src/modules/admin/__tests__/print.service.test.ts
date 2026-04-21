// ─── TASK-084/A-050: Impressão ESC/POS — Unit Tests ───────────────────────────
// Cobre: buildReceiptText, autoPrintOrder, getOrderReceipt

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { buildReceiptText, autoPrintOrder, getOrderReceipt } from '../print.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const ORDER_ID = 'order-1'

const baseOrder = {
  number: 42,
  createdAt: new Date('2024-06-15T14:30:00Z'),
  clientName: 'João Cliente',
  clientWhatsapp: '5548999990001',
  type: 'DELIVERY',
  paymentMethod: 'PIX',
  subtotal: 50.0,
  deliveryFee: 5.0,
  discount: 0,
  total: 55.0,
  notes: null,
  address: {
    street: 'Rua A',
    number: '100',
    complement: 'Apto 2',
    neighborhood: 'Centro',
    city: 'Joinville',
  },
  items: [
    {
      productName: 'Pizza Margherita',
      variationName: 'Grande',
      quantity: 2,
      totalPrice: 50.0,
      notes: 'Sem cebola',
      additionals: [{ name: 'Borda Recheada', price: 8.0 }],
    },
  ],
}

const mockPrismaOrder = {
  id: ORDER_ID,
  ...baseOrder,
  store: { id: 'store-1', name: 'Pizzaria do Zé', features: { auto_print: true } },
  items: baseOrder.items.map((i, idx) => ({ id: `item-${idx}`, ...i })),
}

beforeEach(() => jest.clearAllMocks())

// ─── buildReceiptText ─────────────────────────────────────────────────────────

describe('buildReceiptText', () => {
  it('inclui número do pedido no recibo', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('PEDIDO #42')
  })

  it('inclui nome e WhatsApp do cliente', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('João Cliente')
    expect(text).toContain('5548999990001')
  })

  it('inclui tipo de pedido como label legível (DELIVERY → Entrega)', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('Entrega')
  })

  it('inclui label PICKUP → Retirada', () => {
    const text = buildReceiptText({ ...baseOrder, type: 'PICKUP', address: null })
    expect(text).toContain('Retirada')
  })

  it('inclui label TABLE → Mesa', () => {
    const text = buildReceiptText({ ...baseOrder, type: 'TABLE', address: null })
    expect(text).toContain('Mesa')
  })

  it('inclui forma de pagamento: PIX', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('PIX')
  })

  it('inclui forma de pagamento: CASH_ON_DELIVERY → Dinheiro/Cartão na entrega', () => {
    const text = buildReceiptText({ ...baseOrder, paymentMethod: 'CASH_ON_DELIVERY' })
    expect(text).toContain('Dinheiro')
  })

  it('inclui endereço de entrega quando type=DELIVERY', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('Rua A')
    expect(text).toContain('Centro')
    expect(text).toContain('Joinville')
  })

  it('não inclui endereço quando type=PICKUP', () => {
    const text = buildReceiptText({ ...baseOrder, type: 'PICKUP', address: null })
    expect(text).not.toContain('Rua A')
  })

  it('inclui itens com quantidade e preço', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('2x Pizza Margherita (Grande)')
    expect(text).toContain('R$ 50,00')
  })

  it('inclui adicionais dos itens', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('Borda Recheada')
  })

  it('inclui observação do item quando informada', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('Sem cebola')
  })

  it('inclui taxa de entrega quando > 0', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('Taxa de entrega')
    expect(text).toContain('R$ 5,00')
  })

  it('não inclui linha de taxa de entrega quando = 0', () => {
    const text = buildReceiptText({ ...baseOrder, deliveryFee: 0 })
    expect(text).not.toContain('Taxa de entrega')
  })

  it('inclui desconto quando > 0', () => {
    const text = buildReceiptText({ ...baseOrder, discount: 10.0 })
    expect(text).toContain('Desconto')
    expect(text).toContain('-R$ 10,00')
  })

  it('não inclui linha de desconto quando = 0', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).not.toContain('Desconto')
  })

  it('inclui total formatado em reais', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('TOTAL')
    expect(text).toContain('R$ 55,00')
  })

  it('inclui observação do pedido quando informada', () => {
    const text = buildReceiptText({ ...baseOrder, notes: 'Entregar rápido' })
    expect(text).toContain('Entregar rápido')
  })

  it('exibe N/A para cliente sem nome', () => {
    const text = buildReceiptText({ ...baseOrder, clientName: null })
    expect(text).toContain('N/A')
  })

  it('não inclui variação quando item não tem variação', () => {
    const orderSemVariacao = {
      ...baseOrder,
      items: [{ ...baseOrder.items[0], variationName: null }],
    }
    const text = buildReceiptText(orderSemVariacao)
    expect(text).toContain('Pizza Margherita')
    expect(text).not.toContain('(Grande)')
  })

  it('retorna string com separadores e cabeçalho MENU PANDA', () => {
    const text = buildReceiptText(baseOrder)
    expect(text).toContain('MENU PANDA')
    expect(text).toContain('===')
    expect(text).toContain('---')
  })
})

// ─── autoPrintOrder ───────────────────────────────────────────────────────────

describe('autoPrintOrder', () => {
  it('não imprime quando feature flag auto_print está desabilitada', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockPrismaOrder,
      store: { ...mockPrismaOrder.store, features: { auto_print: false } },
    })

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    await autoPrintOrder(ORDER_ID)

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('[AutoPrint]'), expect.anything(), expect.anything())
    consoleSpy.mockRestore()
  })

  it('não imprime quando features é null (loja sem Premium)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockPrismaOrder,
      store: { ...mockPrismaOrder.store, features: null },
    })

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    await autoPrintOrder(ORDER_ID)

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('[AutoPrint]'), expect.anything(), expect.anything())
    consoleSpy.mockRestore()
  })

  it('loga recibo quando feature flag auto_print está habilitada (Premium)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockPrismaOrder)

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    await autoPrintOrder(ORDER_ID)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AutoPrint] Pedido #42')
    )
    consoleSpy.mockRestore()
  })

  it('não lança erro quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(autoPrintOrder(ORDER_ID)).resolves.toBeUndefined()
  })

  it('captura erros sem propagar (impressora offline não quebra o pedido)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockRejectedValue(new Error('DB connection failed'))

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(autoPrintOrder(ORDER_ID)).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AutoPrint] Erro'),
      ORDER_ID,
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

// ─── getOrderReceipt (A-050: impressão manual) ──────────────────────────────

const STORE_ID = 'store-1'

const mockDbOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  ...baseOrder,
  items: baseOrder.items.map((i, idx) => ({ id: `item-${idx}`, ...i })),
}

describe('getOrderReceipt', () => {
  it('retorna texto do recibo quando pedido existe e pertence à loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockDbOrder)

    const receipt = await getOrderReceipt(STORE_ID, ORDER_ID)

    expect(receipt).toContain('PEDIDO #42')
    expect(receipt).toContain('Pizza Margherita')
    expect(receipt).toContain('TOTAL')
  })

  it('lança erro 404 quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getOrderReceipt(STORE_ID, ORDER_ID)).rejects.toThrow('Pedido não encontrado')
  })

  it('lança erro 404 quando pedido pertence a outra loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockDbOrder,
      storeId: 'outra-loja',
    })

    await expect(getOrderReceipt(STORE_ID, ORDER_ID)).rejects.toThrow('Pedido não encontrado')
  })

  it('chama prisma.order.findUnique com include de items e additionals', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockDbOrder)

    await getOrderReceipt(STORE_ID, ORDER_ID)

    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      include: {
        items: { include: { additionals: true } },
      },
    })
  })
})
