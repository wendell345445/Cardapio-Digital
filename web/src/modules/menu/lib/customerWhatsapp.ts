// Telefone WhatsApp informado no /identifique-se, persistido no navegador.
// É enviado no DTO de createOrder (campo opcional clientWhatsapp) — pedidos
// novos chegam ao backend com o telefone preenchido, e o customerPhone aparece
// no payload de impressão. Pedidos sem telefone (cliente que pulou a
// identificação ou veio direto de mesa) seguem com clientWhatsapp=null.

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
