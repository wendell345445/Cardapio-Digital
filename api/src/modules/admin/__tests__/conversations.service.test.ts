// ─── TASK-106: Conversations Service — Unit Tests (Epic 10) ──────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
    },
  },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: {
    conversationUpdated: jest.fn(),
    conversationTakeover: jest.fn(),
    conversationReleased: jest.fn(),
  },
}))

jest.mock('../../whatsapp/whatsapp.service', () => ({
  sendMessage: jest.fn(),
  sendMessageDirect: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { emit } from '../../../shared/socket/socket'
import { sendMessage } from '../../whatsapp/whatsapp.service'
import {
  getConversations,
  getConversationById,
  takeoverConversation,
  releaseConversation,
  sendAgentMessage,
} from '../conversations.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockEmit = emit as jest.Mocked<typeof emit>
const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>

const STORE_ID = 'store-1'
const OTHER_STORE_ID = 'store-2'
const CONV_ID = 'conv-1'
const AGENT_ID = 'agent-1'

const mockConversation = {
  id: CONV_ID,
  storeId: STORE_ID,
  customerPhone: '11999999999',
  customerName: 'Cliente Teste',
  isHumanMode: false,
  humanAgentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

// ─── getConversations ──────────────────────────────────────────────────────────

describe('getConversations', () => {
  it('should return conversations for the store', async () => {
    const list = [mockConversation]
    ;(mockPrisma.conversation.findMany as jest.Mock).mockResolvedValue(list)

    const result = await getConversations(STORE_ID)

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID } })
    )
    expect(result).toEqual(list)
  })
})

// ─── getConversationById ───────────────────────────────────────────────────────

describe('getConversationById', () => {
  it('should return conversation when storeId matches', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation)
    const result = await getConversationById(STORE_ID, CONV_ID)
    expect(result).toEqual(mockConversation)
  })

  it('should throw 404 when conversation not found', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(getConversationById(STORE_ID, CONV_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('should throw 404 when storeId does not match (tenant isolation)', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      ...mockConversation,
      storeId: OTHER_STORE_ID,
    })
    await expect(getConversationById(STORE_ID, CONV_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── takeoverConversation ──────────────────────────────────────────────────────

describe('takeoverConversation', () => {
  it('should set isHumanMode=true and emit socket', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation)
    const updated = { ...mockConversation, isHumanMode: true, humanAgentId: AGENT_ID }
    ;(mockPrisma.conversation.update as jest.Mock).mockResolvedValue(updated)
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue({})
    mockSendMessage.mockResolvedValue({ ok: true, jid: 'jid@s.whatsapp.net' })

    const result = await takeoverConversation(STORE_ID, CONV_ID, AGENT_ID)

    expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isHumanMode: true, humanAgentId: AGENT_ID } })
    )
    expect(mockEmit.conversationTakeover).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ isHumanMode: true }))
    expect(result.isHumanMode).toBe(true)
  })

  it('should throw 404 when storeId does not match', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue({ ...mockConversation, storeId: OTHER_STORE_ID })
    await expect(takeoverConversation(STORE_ID, CONV_ID, AGENT_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── releaseConversation ───────────────────────────────────────────────────────

describe('releaseConversation', () => {
  it('should set isHumanMode=false and emit socket', async () => {
    const humanConv = { ...mockConversation, isHumanMode: true, humanAgentId: AGENT_ID }
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(humanConv)
    const updated = { ...humanConv, isHumanMode: false, humanAgentId: null }
    ;(mockPrisma.conversation.update as jest.Mock).mockResolvedValue(updated)
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue({})
    mockSendMessage.mockResolvedValue({ ok: true, jid: 'jid@s.whatsapp.net' })

    const result = await releaseConversation(STORE_ID, CONV_ID)

    expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isHumanMode: false, humanAgentId: null } })
    )
    expect(mockEmit.conversationReleased).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ isHumanMode: false }))
    expect(result.isHumanMode).toBe(false)
  })
})

// ─── sendAgentMessage ─────────────────────────────────────────────────────────

describe('sendAgentMessage', () => {
  it('should send message and return ConversationMessage when isHumanMode=true', async () => {
    const humanConv = { ...mockConversation, isHumanMode: true }
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(humanConv)
    const msg = { id: 'msg-1', conversationId: CONV_ID, role: 'AGENT', content: 'Olá!' }
    ;(mockPrisma.conversationMessage.create as jest.Mock).mockResolvedValue(msg)
    ;(mockPrisma.conversation.update as jest.Mock).mockResolvedValue(humanConv)
    mockSendMessage.mockResolvedValue({ ok: true, jid: 'jid@s.whatsapp.net' })

    const result = await sendAgentMessage(STORE_ID, CONV_ID, 'Olá!')

    expect(mockSendMessage).toHaveBeenCalledWith(STORE_ID, humanConv.customerPhone, 'Olá!')
    expect(mockEmit.conversationUpdated).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ message: msg }))
    expect(result.role).toBe('AGENT')
  })

  it('should throw 400 when isHumanMode=false', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue(mockConversation) // isHumanMode=false
    await expect(sendAgentMessage(STORE_ID, CONV_ID, 'Olá!')).rejects.toMatchObject({ status: 400 })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('should throw 404 when storeId does not match (tenant isolation)', async () => {
    ;(mockPrisma.conversation.findUnique as jest.Mock).mockResolvedValue({ ...mockConversation, storeId: OTHER_STORE_ID })
    await expect(sendAgentMessage(STORE_ID, CONV_ID, 'Olá!')).rejects.toMatchObject({ status: 404 })
  })
})
