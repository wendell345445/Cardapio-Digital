// TASK-130: identidade do cliente sem login.
// Gera (e persiste em localStorage) um UUID estável por navegador. Esse ID
// é enviado no createOrder e usado pra listar "meus pedidos" (mesma máquina).
// Aviso: limpar localStorage / abrir em outro device → outra "identidade".

const STORAGE_KEY = 'mp_customer_session_id'

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function genUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback simples — só para ambientes muito antigos (testes, jsdom legado).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getCustomerSessionId(): string {
  if (typeof window === 'undefined') return genUuid()
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isUuid(stored)) return stored
    const fresh = genUuid()
    window.localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage bloqueado (modo privado em alguns browsers): devolve um id
    // válido pra essa session em memória — não persiste, mas o pedido vai sair.
    return genUuid()
  }
}

export function resetCustomerSessionId(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
