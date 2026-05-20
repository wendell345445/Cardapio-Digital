/**
 * Helpers de máscara para inputs do formulário de auto-cadastro.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Aplica máscara `XXXXX-XXX` em CEP.
 * Aceita strings parcialmente preenchidas (truncamento progressivo).
 */
export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

/**
 * Aplica máscara `(XX) XXXXX-XXXX` em telefone/WhatsApp BR (11 dígitos).
 */
export function maskWhatsapp(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Formata telefone armazenado (com ou sem DDI 55) como `+55 (xx) xxxxx-xxxx`
 * (móvel) ou `+55 (xx) xxxx-xxxx` (fixo). Retorna string vazia se inválido.
 *
 * Aceita 10 dígitos (DDD+8) ou 11 dígitos (DDD+9) e também strings que já
 * incluam o prefixo 55 (12/13 dígitos totais).
 */
export function formatBrPhone(value: string | null | undefined): string {
  if (!value) return ''
  let digits = onlyDigits(value)
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) digits = digits.slice(2)
  }
  if (digits.length !== 10 && digits.length !== 11) return ''
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (digits.length === 11) {
    return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
}
