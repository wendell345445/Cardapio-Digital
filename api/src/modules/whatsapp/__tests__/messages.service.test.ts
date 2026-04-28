// C-040: motivo de cancelamento no template WhatsApp
// TASK-130: gate por flag notifyOnStatusChange em sendStatusUpdateMessage

jest.mock('../whatsapp.queue', () => ({
  enqueueWhatsApp: jest.fn().mockResolvedValue({ id: 'job-1' }),
}))

jest.mock('../../admin/whatsapp-messages.service', () => ({
  getTemplate: jest.fn(),
}))

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn() },
  },
}))

import {
  renderAndEnqueueStatusMessage,
  sendStatusUpdateMessage,
} from '../messages.service'
import { enqueueWhatsApp } from '../whatsapp.queue'
import { getTemplate } from '../../admin/whatsapp-messages.service'
import { prisma } from '../../../shared/prisma/prisma'

const mockGetTemplate = getTemplate as jest.Mock
const mockEnqueue = enqueueWhatsApp as jest.Mock
const mockOrderFindFirst = prisma.order.findFirst as jest.Mock

describe('renderAndEnqueueStatusMessage — CANCELLED + cancelReason (C-040)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 'job-1' })
    mockGetTemplate.mockResolvedValue(
      '❌ *Pedido #{{numero}} cancelado.*\n{{motivo}}Entre em contato com {{loja}} para mais informações.'
    )
  })

  it('insere o motivo no template quando cancelReason é informado', async () => {
    await renderAndEnqueueStatusMessage(
      'store-1', '5511999990000', 42, 'CANCELLED', 'Loja Teste', 'DELIVERY',
      { cancelReason: 'Produto em falta' }
    )

    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const [payload] = mockEnqueue.mock.calls[0]
    expect(payload.text).toContain('Pedido #42 cancelado')
    expect(payload.text).toContain('Motivo: _Produto em falta_')
    expect(payload.text).toContain('Loja Teste')
    expect(payload.text).not.toContain('{{motivo}}')
  })

  it('omite a linha de motivo quando cancelReason não é informado', async () => {
    await renderAndEnqueueStatusMessage(
      'store-1', '5511999990000', 42, 'CANCELLED', 'Loja Teste', 'DELIVERY'
    )

    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const [payload] = mockEnqueue.mock.calls[0]
    expect(payload.text).toContain('Pedido #42 cancelado')
    expect(payload.text).not.toContain('Motivo:')
    expect(payload.text).not.toContain('{{motivo}}')
  })
})

describe('sendStatusUpdateMessage — gate por notifyOnStatusChange (TASK-130)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 'job-1' })
    mockGetTemplate.mockResolvedValue('Pedido #{{numero}} confirmado!')
  })

  it('NÃO envia quando flag é false', async () => {
    mockOrderFindFirst.mockResolvedValue({ notifyOnStatusChange: false })
    await sendStatusUpdateMessage('store-1', '5511999990000', 42, 'CONFIRMED', 'Loja')
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('NÃO envia quando pedido não existe', async () => {
    mockOrderFindFirst.mockResolvedValue(null)
    await sendStatusUpdateMessage('store-1', '5511999990000', 99, 'CONFIRMED', 'Loja')
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('envia quando flag é true', async () => {
    mockOrderFindFirst.mockResolvedValue({ notifyOnStatusChange: true })
    await sendStatusUpdateMessage('store-1', '5511999990000', 42, 'CONFIRMED', 'Loja')
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
  })
})
