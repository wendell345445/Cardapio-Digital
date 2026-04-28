// Nome do cliente persistido no navegador, no mesmo espírito de
// `customerAddresses` — conveniência pra não pedir o nome de novo
// a cada pedido. Sem split por loja: nome é do cliente, não da loja.

const STORAGE_KEY = 'mp_customer_name'

export function getCustomerName(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveCustomerName(name: string): void {
  if (typeof window === 'undefined') return
  const trimmed = name.trim()
  if (!trimmed) return
  try {
    window.localStorage.setItem(STORAGE_KEY, trimmed)
  } catch {
    // localStorage cheio ou bloqueado — ignora.
  }
}

export function clearCustomerName(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
