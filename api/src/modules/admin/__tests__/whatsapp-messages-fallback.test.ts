// ─── TASK-121: WhatsApp Messages — Fallback de Template e Disparo Universal ─────
// Cobre: getTemplate fallback, sendStatusUpdateMessage todos os modos/eventos

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    whatsAppTemplate: {
      findUnique: jest.fn(),
    },
    // TASK-130: sendStatusUpdateMessage consulta o pedido pra checar a flag
    order: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('../../whatsapp/whatsapp.queue', () => ({
  enqueueWhatsApp: jest.fn().mockResolvedValue({ id: 'job-1' }),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { enqueueWhatsApp } from '../../whatsapp/whatsapp.queue'
import {
  getTemplate,
  DEFAULT_TEMPLATES,
  ALL_EVENT_TYPES,
  type WhatsAppEventType,
} from '../whatsapp-messages.service'
import { sendStatusUpdateMessage } from '../../whatsapp/messages.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockSendMessage = enqueueWhatsApp as jest.Mock

const STORE_ID = 'store-1'

describe('getTemplate — fallback para DEFAULT_TEMPLATES', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve retornar template customizado quando existir', async () => {
    const customTemplate = 'Olá {{loja}}! Pedido #{{numero}} foi confirmado.'
    ;(mockPrisma.whatsAppTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: 'tpl-1',
      storeId: STORE_ID,
      eventType: 'CONFIRMED',
      template: customTemplate,
    })

    const result = await getTemplate(STORE_ID, 'CONFIRMED')
    expect(result).toBe(customTemplate)
  })

  it('deve retornar DEFAULT_TEMPLATES quando não há template customizado (null)', async () => {
    ;(mockPrisma.whatsAppTemplate.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getTemplate(STORE_ID, 'CONFIRMED')
    expect(result).toBe(DEFAULT_TEMPLATES.CONFIRMED)
    expect(result).not.toBeNull()
    expect(result).not.toBeUndefined()
    expect(result.length).toBeGreaterThan(0)
  })

  it('deve nunca retornar null — todos os 11 event types têm default', async () => {
    ;(mockPrisma.whatsAppTemplate.findUnique as jest.Mock).mockResolvedValue(null)

    for (const eventType of ALL_EVENT_TYPES) {
      const result = await getTemplate(STORE_ID, eventType as WhatsAppEventType)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it('DEFAULT_TEMPLATES cobre todos os 11 event types', () => {
    for (const eventType of ALL_EVENT_TYPES) {
      expect(DEFAULT_TEMPLATES[eventType as WhatsAppEventType]).toBeTruthy()
    }
  })
})

describe('sendStatusUpdateMessage — disparo universal por modo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.whatsAppTemplate.findUnique as jest.Mock).mockResolvedValue(null)
    // TASK-130: simula pedido com opt-in ativo para os testes existentes
    // continuarem cobrindo o disparo universal por evento.
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ notifyOnStatusChange: true })
  })

  const PHONE = '5548999990001'
  const ORDER_NUMBER = 42
  const STORE_NAME = 'Pizzaria Dona Maria'

  it('envia mensagem CONFIRMED com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'CONFIRMED', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [payload] = mockSendMessage.mock.calls[0]
    expect(payload.storeId).toBe(STORE_ID)
    expect(payload.to).toBe(PHONE)
    expect(payload.text).toContain(String(ORDER_NUMBER))
  })

  it('envia mensagem PREPARING com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'PREPARING', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('envia mensagem DISPATCHED com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'DISPATCHED', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('envia mensagem DELIVERED com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'DELIVERED', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('envia mensagem CANCELLED com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'CANCELLED', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('envia mensagem WAITING_PAYMENT com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'WAITING_PAYMENT', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('envia READY_FOR_PICKUP quando status=READY e tipo=PICKUP', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'READY', STORE_NAME, 'PICKUP')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [payload] = mockSendMessage.mock.calls[0]
    // O template padrão de READY_FOR_PICKUP contém "retirada"
    expect(payload.text.toLowerCase()).toContain('retirada')
  })

  it('NÃO envia mensagem quando status=READY e tipo=DELIVERY (motoboy cuida do disparo)', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'READY', STORE_NAME, 'DELIVERY')
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('NÃO envia mensagem para status sem mapeamento (ex: WAITING_PAYMENT_PROOF)', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'WAITING_PAYMENT_PROOF', STORE_NAME)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('substitui variáveis {{numero}} e {{loja}} no template', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'CONFIRMED', STORE_NAME)
    const [payload] = mockSendMessage.mock.calls[0]
    expect(payload.text).toContain(String(ORDER_NUMBER))
    expect(payload.text).toContain(STORE_NAME)
    expect(payload.text).not.toContain('{{numero}}')
    expect(payload.text).not.toContain('{{loja}}')
  })

  it('usa template customizado quando disponível (ignora modo)', async () => {
    const customTemplate = 'CUSTOM: Pedido #{{numero}} confirmado na {{loja}}!'
    ;(mockPrisma.whatsAppTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: 'tpl-1',
      storeId: STORE_ID,
      eventType: 'CONFIRMED',
      template: customTemplate,
    })

    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'CONFIRMED', STORE_NAME)
    const [payload] = mockSendMessage.mock.calls[0]
    expect(payload.text).toContain('CUSTOM:')
    expect(payload.text).toContain(String(ORDER_NUMBER))
    expect(payload.text).toContain(STORE_NAME)
  })
})
