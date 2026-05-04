// Telefone WhatsApp persistido no navegador. NÃO é enviado pro backend
// nem usado em nenhum DTO de pedido (TASK-130 removeu captura de WhatsApp
// do fluxo público). Persistimos apenas pra o campo "Identifique-se" não
// resetar quando o cliente navega pra outra tela e volta.
//
// O número real do cliente vem depois via opt-in WhatsApp inbound.

const STORAGE_KEY = 'mp_customer_whatsapp'

export function getCustomerWhatsapp(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveCustomerWhatsapp(value: string): void {
  if (typeof window === 'undefined') return
  const trimmed = value.trim()
  try {
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STORAGE_KEY, trimmed)
  } catch {
    // localStorage cheio ou bloqueado — ignora.
  }
}
