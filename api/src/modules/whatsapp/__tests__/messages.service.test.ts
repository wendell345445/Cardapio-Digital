// C-040: motivo de cancelamento no template WhatsApp

jest.mock('../whatsapp.service', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../admin/whatsapp-messages.service', () => ({
  getTemplate: jest.fn(),
}))

import { sendStatusUpdateMessage } from '../messages.service'
import { sendMessage } from '../whatsapp.service'
import { getTemplate } from '../../admin/whatsapp-messages.service'

const mockGetTemplate = getTemplate as jest.Mock
const mockSendMessage = sendMessage as jest.Mock

describe('sendStatusUpdateMessage — CANCELLED + cancelReason (C-040)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTemplate.mockResolvedValue(
      '❌ *Pedido #{{numero}} cancelado.*\n{{motivo}}Entre em contato com {{loja}} para mais informações.'
    )
  })

  it('insere o motivo no template quando cancelReason é informado', async () => {
    await sendStatusUpdateMessage(
      'store-1', '5511999990000', 42, 'CANCELLED', 'Loja Teste', 'DELIVERY',
      { cancelReason: 'Produto em falta' }
    )

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [, , text] = mockSendMessage.mock.calls[0]
    expect(text).toContain('Pedido #42 cancelado')
    expect(text).toContain('Motivo: _Produto em falta_')
    expect(text).toContain('Loja Teste')
    expect(text).not.toContain('{{motivo}}')
  })

  it('omite a linha de motivo quando cancelReason não é informado', async () => {
    await sendStatusUpdateMessage(
      'store-1', '5511999990000', 42, 'CANCELLED', 'Loja Teste', 'DELIVERY'
    )

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const [, , text] = mockSendMessage.mock.calls[0]
    expect(text).toContain('Pedido #42 cancelado')
    expect(text).not.toContain('Motivo:')
    expect(text).not.toContain('{{motivo}}')
  })
})
