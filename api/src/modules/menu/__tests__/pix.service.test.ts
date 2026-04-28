// ─── TASK-086: Pix — Geração de QR Code e Copia e Cola — Unit Tests ──────────
// Cobre: generatePix com diferentes tipos de chave, CRC16, payload EMV, sanitização

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

describe('generatePix', () => {
  it('retorna qrCodeBase64 e copyPaste', async () => {
    const result = await generatePix(baseParams)

    expect(result).toHaveProperty('qrCodeBase64')
    expect(result).toHaveProperty('copyPaste')
    expect(result.qrCodeBase64).toContain('data:image/png;base64,')
  })

  it('copyPaste contém a chave Pix no payload (email lowercase)', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('pix@pizzaria.com')
  })

  it('copyPaste contém o nome do merchant em uppercase saneado', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('PIZZARIA DO ZE')
  })

  it('copyPaste contém a cidade do merchant em uppercase', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('JOINVILLE')
  })

  it('payload usa br.gov.bcb.pix em lowercase como GUI', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('br.gov.bcb.pix')
  })

  it('payload termina com 4 caracteres hexadecimais (CRC16)', async () => {
    const result = await generatePix(baseParams)
    const crc = result.copyPaste.slice(-4)
    expect(crc).toMatch(/^[0-9A-F]{4}$/)
  })

  it('payload contém tag 6304 (CRC placeholder)', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toMatch(/6304[0-9A-F]{4}$/)
  })

  it('inclui valor quando amount > 0', async () => {
    const result = await generatePix({ ...baseParams, amount: 99.90 })
    expect(result.copyPaste).toContain('99.90')
  })

  it('não inclui campo de valor quando amount = 0', async () => {
    const result = await generatePix({ ...baseParams, amount: 0 })
    expect(result.copyPaste).not.toContain('5406')
  })

  it('normaliza CPF removendo pontuação', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '123.456.789-00', pixKeyType: 'CPF' })
    expect(result.copyPaste).toContain('12345678900')
    expect(result.copyPaste).not.toContain('123.456.789-00')
  })

  it('normaliza CNPJ removendo pontuação', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '12.345.678/0001-99', pixKeyType: 'CNPJ' })
    expect(result.copyPaste).toContain('12345678000199')
    expect(result.copyPaste).not.toContain('12.345.678/0001-99')
  })

  it('normaliza telefone para +55', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '48999990000', pixKeyType: 'PHONE' })
    expect(result.copyPaste).toContain('+5548999990000')
  })

  it('mantém telefone que já tem +55', async () => {
    const result = await generatePix({ ...baseParams, pixKey: '+5548999990000', pixKeyType: 'PHONE' })
    expect(result.copyPaste).toContain('+5548999990000')
  })

  it('funciona com chave aleatória (EVP) como pixKey', async () => {
    const evpKey = 'a4b2c3d4-e5f6-7890-abcd-ef1234567890'
    const result = await generatePix({ ...baseParams, pixKey: evpKey, pixKeyType: 'EVP' })
    expect(result.copyPaste).toContain(evpKey)
  })

  it('trunca merchantName para 25 caracteres e remove acento', async () => {
    const longName = 'Pizzaria do Zé e do Gato Preto'
    const result = await generatePix({ ...baseParams, merchantName: longName })
    expect(result.copyPaste).toContain('PIZZARIA DO ZE E DO GATO ')
    expect(result.copyPaste).not.toContain('Zé')
  })

  it('trunca merchantCity para 15 caracteres e remove acento', async () => {
    const longCity = 'Florianópolis do Sul'
    const result = await generatePix({ ...baseParams, merchantCity: longCity })
    expect(result.copyPaste).toContain('FLORIANOPOLIS D')
    expect(result.copyPaste).not.toContain('Florianópolis')
  })

  it('usa *** como txid padrão quando não informado', async () => {
    const result = await generatePix({ ...baseParams, txid: undefined })
    expect(result.copyPaste).toContain('***')
  })

  it('trunca txid para 25 caracteres e remove pontuação', async () => {
    const longTxid = 'pedido-muito-longo-com-mais-de-25-chars'
    const result = await generatePix({ ...baseParams, txid: longTxid })
    expect(result.copyPaste).toContain('pedidomuitolongocommaisde')
    expect(result.copyPaste).not.toContain('pedido-muito')
  })

  it('contém country code BR no payload', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('5802BR')
  })

  it('contém currency BRL (986) no payload', async () => {
    const result = await generatePix(baseParams)
    expect(result.copyPaste).toContain('5303986')
  })

  it('dois CRCs diferentes para payloads diferentes', async () => {
    const r1 = await generatePix({ ...baseParams, amount: 10.0 })
    const r2 = await generatePix({ ...baseParams, amount: 20.0 })
    const crc1 = r1.copyPaste.slice(-4)
    const crc2 = r2.copyPaste.slice(-4)
    expect(crc1).not.toBe(crc2)
  })

  it('fallback "LOJA" quando merchantName fica vazio após sanitização', async () => {
    const result = await generatePix({ ...baseParams, merchantName: '🍕🍔' })
    expect(result.copyPaste).toContain('LOJA')
  })

  it('fallback "BRASIL" quando merchantCity fica vazia após sanitização', async () => {
    const result = await generatePix({ ...baseParams, merchantCity: '!!!' })
    expect(result.copyPaste).toContain('BRASIL')
  })
})
