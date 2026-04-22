// C-040: motivo de cancelamento no template WhatsApp

jest.mock('../whatsapp.queue', () => ({
  enqueueWhatsApp: jest.fn().mockResolvedValue({ id: 'job-1' }),
}))

jest.mock('../../admin/whatsapp-messages.service', () => ({
  getTemplate: jest.fn(),
}))

import { sendStatusUpdateMessage } from '../messages.service'
import { enqueueWhatsApp } from '../whatsapp.queue'
import { getTemplate } from '../../admin/whatsapp-messages.service'

const mockGetTemplate = getTemplate as jest.Mock
const mockEnqueue = enqueueWhatsApp as jest.Mock

describe('sendStatusUpdateMessage — CANCELLED + cancelReason (C-040)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 'job-1' })
    mockGetTemplate.mockResolvedValue(
      '❌ *Pedido #{{numero}} cancelado.*\n{{motivo}}Entre em contato com {{loja}} para mais informações.'
    )
  })

  it('insere o motivo no template quando cancelReason é informado', async () => {
    await sendStatusUpdateMessage(
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
    await sendStatusUpdateMessage(
      'store-1', '5511999990000', 42, 'CANCELLED', 'Loja Teste', 'DELIVERY'
    )

    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const [payload] = mockEnqueue.mock.calls[0]
    expect(payload.text).toContain('Pedido #42 cancelado')
    expect(payload.text).not.toContain('Motivo:')
    expect(payload.text).not.toContain('{{motivo}}')
  })
})
