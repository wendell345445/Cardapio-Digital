// ─── TASK-084/A-050: Impressão ESC/POS — Unit Tests ───────────────────────────
// Cobre: buildReceiptText, autoPrintOrder, getOrderReceipt

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
    printJob: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { buildReceiptText, autoPrintOrder, enqueuePrintJob, getOrderReceipt } from '../print.service'

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
  storeId: 'store-1',
  ...baseOrder,
  store: { id: 'store-1', name: 'Pizzaria do Zé', autoConfirmOrders: false, features: { auto_print: true } },
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

  it('quebra endereço longo em múltiplas linhas (max 42 colunas)', () => {
    const longAddr = {
      ...baseOrder,
      address: {
        street: 'Rua Senador Souza Naves',
        number: '1100',
        complement: '',
        neighborhood: 'Centro',
        city: 'Londrina',
      },
    }
    const text = buildReceiptText(longAddr)
    const receiptLines = text.split('\n')
    for (const line of receiptLines) {
      expect(line.length).toBeLessThanOrEqual(42)
    }
    expect(text).toContain('Rua Senador Souza Naves')
    expect(text).toContain('Londrina')
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
  it('não enfileira quando feature flag auto_print está desabilitada', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockPrismaOrder,
      store: { ...mockPrismaOrder.store, features: { auto_print: false } },
    })

    await autoPrintOrder(ORDER_ID)

    expect(mockPrisma.printJob.create).not.toHaveBeenCalled()
  })

  it('não enfileira quando features é null (loja sem Premium)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockPrismaOrder,
      store: { ...mockPrismaOrder.store, features: null },
    })

    await autoPrintOrder(ORDER_ID)

    expect(mockPrisma.printJob.create).not.toHaveBeenCalled()
  })

  it('enfileira PrintJob(PENDING) quando feature flag auto_print está habilitada (override Premium)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockPrismaOrder)

    await autoPrintOrder(ORDER_ID)

    expect(mockPrisma.printJob.create).toHaveBeenCalledWith({
      data: {
        storeId: 'store-1',
        orderId: ORDER_ID,
      },
    })
  })

  it('enfileira quando autoConfirmOrders está ON mesmo sem auto_print (toggle único)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockPrismaOrder,
      store: { ...mockPrismaOrder.store, autoConfirmOrders: true, features: { auto_print: false } },
    })

    await autoPrintOrder(ORDER_ID)

    expect(mockPrisma.printJob.create).toHaveBeenCalledWith({
      data: { storeId: 'store-1', orderId: ORDER_ID },
    })
  })

  it('é idempotente quando PrintJob já existe (Prisma P2002 não propaga)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockPrismaOrder)
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    ;(mockPrisma.printJob.create as jest.Mock).mockRejectedValue(p2002)

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(autoPrintOrder(ORDER_ID)).resolves.toBeUndefined()

    // Não deve logar erro — P2002 é fluxo esperado de idempotência.
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('não lança erro quando pedido não encontrado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(autoPrintOrder(ORDER_ID)).resolves.toBeUndefined()
    expect(mockPrisma.printJob.create).not.toHaveBeenCalled()
  })

  it('captura erros sem propagar (banco offline não quebra o pedido)', async () => {
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

// ─── enqueuePrintJob (botão "Imprimir") ───────────────────────────────────────

describe('enqueuePrintJob', () => {
  const orderWithFlag = (auto_print: boolean | null, autoConfirmOrders = false) => ({
    id: ORDER_ID,
    storeId: STORE_ID,
    store: {
      autoConfirmOrders,
      features: auto_print === null ? null : { auto_print },
    },
  })

  it('lança 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(enqueuePrintJob(STORE_ID, ORDER_ID)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.printJob.upsert).not.toHaveBeenCalled()
  })

  it('lança 404 quando pedido pertence a outra loja', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...orderWithFlag(true),
      storeId: 'outra-loja',
    })

    await expect(enqueuePrintJob(STORE_ID, ORDER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('retorna queued=false e NÃO enfileira quando auto_print está OFF', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithFlag(false))

    const result = await enqueuePrintJob(STORE_ID, ORDER_ID)

    expect(result).toEqual({ queued: false })
    expect(mockPrisma.printJob.upsert).not.toHaveBeenCalled()
  })

  it('retorna queued=false quando features é null (sem Premium)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithFlag(null))

    const result = await enqueuePrintJob(STORE_ID, ORDER_ID)

    expect(result).toEqual({ queued: false })
    expect(mockPrisma.printJob.upsert).not.toHaveBeenCalled()
  })

  it('enfileira (upsert → PENDING) e retorna queued=true quando auto_print ON', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithFlag(true))
    ;(mockPrisma.printJob.upsert as jest.Mock).mockResolvedValue({})

    const result = await enqueuePrintJob(STORE_ID, ORDER_ID)

    expect(result).toEqual({ queued: true })
    expect(mockPrisma.printJob.upsert).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
      create: { storeId: STORE_ID, orderId: ORDER_ID },
      update: { status: 'PENDING', printedAt: null },
    })
  })

  it('enfileira (queued=true) quando autoConfirmOrders ON mesmo sem auto_print', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithFlag(false, true))
    ;(mockPrisma.printJob.upsert as jest.Mock).mockResolvedValue({})

    const result = await enqueuePrintJob(STORE_ID, ORDER_ID)

    expect(result).toEqual({ queued: true })
    expect(mockPrisma.printJob.upsert).toHaveBeenCalled()
  })
})
