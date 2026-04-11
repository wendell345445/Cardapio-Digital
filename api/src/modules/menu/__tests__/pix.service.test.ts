// ─── TASK-086: Pix — Geração de QR Code e Copia e Cola — Unit Tests ──────────
// Cobre: generatePix com diferentes tipos de chave, CRC16, payload EMV

jest.mock('qrcode', () => ({
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK_QR'),
  },
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK_QR'),
}))

import { generatePix } from '../pix.service'

const baseParams = {
  pixKey: 'pix@pizzaria.com',
  pixKeyType: 'EMAIL',
  amount: 50.0,
  merchantName: 'Pizzaria do Ze',
  merchantCity: 'Joinville',
  txid: 'pedido123',
}

// ─── generatePix ──────────────────────────────────────────────────────────────

describe('generatePix', () => {
  it('retorna qrCodeBase64 e copyPaste', async () => {
    const result = await generatePix(baseParams)

    expect(result).toHaveProperty('qrCodeBase64')
    expect(result).toHaveProperty('copyPaste')
    expect(result.qrCodeBase64).toContain('data:image/png;base64,')
  })

  it('copyPaste contém a chave Pix no payload', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('pix@pizzaria.com')
  })

  it('copyPaste contém o nome do merchant', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('Pizzaria do Ze')
  })

  it('copyPaste contém a cidade do merchant', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('Joinville')
  })

  it('payload contém BR.GOV.BCB.PIX como GUI', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('BR.GOV.BCB.PIX')
  })

  it('payload termina com 4 caracteres hexadecimais (CRC16)', async () => {
    const result = await generatePix(baseParams)
    const crc = result.copyPaste.slice(-4)
    expect(crc).toMatch(/^[0-9A-F]{4}$/)
  })

  it('payload contém tag 6304 (CRC placeholder)', async () => {
    const result = await generatePix(baseParams)
    // "6304" + 4 hex chars = CRC field
    expect(result.copyPaste).toMatch(/6304[0-9A-F]{4}$/)
  })

  it('inclui valor quando amount > 0', async () => {
    const result = await generatePix({ ...baseParams, amount: 99.90 })
    expect(result.copyPaste).toContain('99.90')
  })

  it('não inclui campo de valor quando amount = 0', async () => {
    const result = await generatePix({ ...baseParams, amount: 0 })
    // Field 54 (amount) should be absent
    expect(result.copyPaste).not.toContain('5406')
  })

  it('funciona com chave CPF como pixKey', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '123.456.789-00', pixKeyType: 'CPF' })
    expect(result.copyPaste).toContain('123.456.789-00')
  })

  it('funciona com chave CNPJ como pixKey', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '12.345.678/0001-99', pixKeyType: 'CNPJ' })
    expect(result.copyPaste).toContain('12.345.678/0001-99')
  })

  it('funciona com chave telefone como pixKey', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '+5548999990000', pixKeyType: 'PHONE' })
    expect(result.copyPaste).toContain('+5548999990000')
  })

  it('funciona com chave aleatória (EVP) como pixKey', async () => {
    const evpKey = 'a4b2c3d4-e5f6-7890-abcd-ef1234567890'
    const result = await generatePix({ ...baseParams, pixKey: evpKey, pixKeyType: 'EVP' })
    expect(result.copyPaste).toContain(evpKey)
  })

  it('trunca merchantName para 25 caracteres', async () => {
    const longName = 'Pizzaria do Zé e do Gato Preto'
    const result = await generatePix({ ...baseParams, merchantName: longName })
    // O nome no payload não pode exceder 25 chars
    expect(result.copyPaste).toContain(longName.slice(0, 25))
    expect(result.copyPaste).not.toContain(longName)
  })

  it('trunca merchantCity para 15 caracteres', async () => {
    const longCity = 'Florianópolis do Sul'
    const result = await generatePix({ ...baseParams, merchantCity: longCity })
    expect(result.copyPaste).toContain(longCity.slice(0, 15))
  })

  it('usa *** como txid padrão quando não informado', async () => {
    const result = await generatePix({ ...baseParams, txid: undefined })
    expect(result.copyPaste).toContain('***')
  })

  it('trunca txid para 25 caracteres', async () => {
    const longTxid = 'pedido-muito-longo-com-mais-de-25-chars'
    const result = await generatePix({ ...baseParams, txid: longTxid })
    expect(result.copyPaste).toContain(longTxid.slice(0, 25))
    expect(result.copyPaste).not.toContain(longTxid)
  })

  it('contém country code BR no payload', async () => {
    const result = await generatePix(baseParams)
    // Field 58 = country code "BR"
    expect(result.copyPaste).toContain('5802BR')
  })

  it('contém currency BRL (986) no payload', async () => {
    const result = await generatePix(baseParams)
    // Field 53 = transaction currency "986"
    expect(result.copyPaste).toContain('5303986')
  })

  it('dois CRCs diferentes para payloads diferentes', async () => {
    const r1 = await generatePix({ ...baseParams, amount: 10.0 })
    const r2 = await generatePix({ ...baseParams, amount: 20.0 })
    const crc1 = r1.copyPaste.slice(-4)
    const crc2 = r2.copyPaste.slice(-4)
    expect(crc1).not.toBe(crc2)
  })
})
