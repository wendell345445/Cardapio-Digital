import QRCode from 'qrcode'

export interface PixData {
  qrCodeBase64: string // PNG base64 (data:image/png;base64,...)
  copyPaste: string    // string Pix copia e cola
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16(str: string): string {
  let crc = 0xffff
  for (const char of str) {
    crc ^= char.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function sanitizeText(input: string, max: number): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, max)
    .toUpperCase()
}

function sanitizeTxid(txid: string): string {
  const cleaned = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25)
  return cleaned.length > 0 ? cleaned : '***'
}

function normalizePixKey(key: string, type: string): string {
  switch (type.toUpperCase()) {
    case 'CPF':
    case 'CNPJ':
      return key.replace(/\D/g, '')
    case 'PHONE': {
      const digits = key.replace(/\D/g, '')
      return digits.startsWith('55') ? `+${digits}` : `+55${digits}`
    }
    case 'EMAIL':
      return key.trim().toLowerCase()
    default:
      return key.trim()
  }
}

export async function generatePix(params: {
  pixKey: string
  pixKeyType: string
  amount: number
  merchantName: string
  merchantCity: string
  txid?: string
}): Promise<PixData> {
  const { pixKey, pixKeyType, amount, merchantName, merchantCity, txid = '***' } = params

  const key = normalizePixKey(pixKey, pixKeyType)
  const name = sanitizeText(merchantName, 25) || 'LOJA'
  const city = sanitizeText(merchantCity, 15) || 'BRASIL'
  const safeTxid = sanitizeTxid(txid)

  // Field 26: Merchant Account Information
  const pixGui = tlv('00', 'br.gov.bcb.pix') + tlv('01', key)
  const field26 = tlv('26', pixGui)

  // Field 62: Additional Data Field (txid)
  const field62 = tlv('62', tlv('05', safeTxid))

  // Build payload without CRC
  const payload =
    tlv('00', '01') +       // Payload Format Indicator
    field26 +               // Merchant Account Information
    tlv('52', '0000') +     // MCC
    tlv('53', '986') +      // Transaction Currency (BRL)
    (amount > 0 ? tlv('54', amount.toFixed(2)) : '') + // Amount
    tlv('58', 'BR') +       // Country Code
    tlv('59', name) +       // Merchant Name
    tlv('60', city) +       // Merchant City
    field62 +               // Additional Data
    '6304'                  // CRC placeholder tag+length

  const crc = crc16(payload)
  const copyPaste = payload + crc

  const qrCodeBase64 = await QRCode.toDataURL(copyPaste)

  return { qrCodeBase64, copyPaste }
}
