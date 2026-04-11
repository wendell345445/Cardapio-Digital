// ─── TASK-121: WhatsApp Messages — Fallback de Template e Disparo Universal ─────
// Cobre: getTemplate fallback, sendStatusUpdateMessage todos os modos/eventos

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    whatsAppTemplate: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('../../whatsapp/whatsapp.service', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { sendMessage } from '../../whatsapp/whatsapp.service'
import {
  getTemplate,
  DEFAULT_TEMPLATES,
  ALL_EVENT_TYPES,
  type WhatsAppEventType,
} from '../whatsapp-messages.service'
import { sendStatusUpdateMessage } from '../../whatsapp/messages.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>

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
  })

  const PHONE = '5548999990001'
  const ORDER_NUMBER = 42
  const STORE_NAME = 'Pizzaria Dona Maria'

  it('envia mensagem CONFIRMED com template padrão', async () => {
    await sendStatusUpdateMessage(STORE_ID, PHONE, ORDER_NUMBER, 'CONFIRMED', STORE_NAME)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [calledStoreId, calledPhone, calledText] = mockSendMessage.mock.calls[0]
    expect(calledStoreId).toBe(STORE_ID)
    expect(calledPhone).toBe(PHONE)
    expect(calledText).toContain(String(ORDER_NUMBER))
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
    const [, , calledText] = mockSendMessage.mock.calls[0]
    // O template padrão de READY_FOR_PICKUP contém "retirada"
    expect(calledText.toLowerCase()).toContain('retirada')
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
    const [, , calledText] = mockSendMessage.mock.calls[0]
    expect(calledText).toContain(String(ORDER_NUMBER))
    expect(calledText).toContain(STORE_NAME)
    expect(calledText).not.toContain('{{numero}}')
    expect(calledText).not.toContain('{{loja}}')
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
    const [, , calledText] = mockSendMessage.mock.calls[0]
    expect(calledText).toContain('CUSTOM:')
    expect(calledText).toContain(String(ORDER_NUMBER))
    expect(calledText).toContain(STORE_NAME)
  })
})
