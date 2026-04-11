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
