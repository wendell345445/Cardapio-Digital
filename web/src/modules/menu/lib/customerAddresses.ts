// TASK-130 (parte 3): histórico de endereços do cliente em localStorage.
//
// Lista global (sem split por loja — endereço é propriedade do cliente).
// Ordenada por lastUsedAt desc; helper de save deduplica pelo "match key"
// (cep+rua+número, normalizado) e atualiza `lastUsedAt` em vez de criar
// um duplicado.

const STORAGE_KEY = 'mp_customer_addresses'
const MAX_ADDRESSES = 10

export interface SavedAddress {
  id: string
  zipCode?: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state?: string
  // Coords vindas do Google Places (quando o endereco foi escolhido via
  // autocomplete). Permite pular geocode no backend em pedidos futuros.
  // Opcionais pra compat com registros antigos salvos antes do Places.
  latitude?: number
  longitude?: number
  formattedAddress?: string
  lastUsedAt: number
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalize(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Chave de dedup: zipCode (só dígitos) + street + number. Complemento e
// bairro/cidade não entram porque ViaCEP/correção pode preencher diferente
// pra mesma localização.
function matchKey(a: Pick<SavedAddress, 'zipCode' | 'street' | 'number'>): string {
  const cep = (a.zipCode ?? '').replace(/\D/g, '')
  return `${cep}|${normalize(a.street)}|${normalize(a.number)}`
}

function read(): SavedAddress[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidAddress)
  } catch {
    return []
  }
}

function isValidAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false
  const a = value as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    typeof a.street === 'string' &&
    typeof a.number === 'string' &&
    typeof a.neighborhood === 'string' &&
    typeof a.city === 'string' &&
    typeof a.lastUsedAt === 'number'
  )
}

function write(list: SavedAddress[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage cheio ou bloqueado (modo privado em alguns browsers):
    // ignora — endereços são conveniência, não dado crítico.
  }
}

/** Endereços ordenados por uso recente (mais recente primeiro). */
export function listAddresses(): SavedAddress[] {
  return read().sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** Último endereço usado (pré-seleção no checkout) ou null se não houver. */
export function lastUsedAddress(): SavedAddress | null {
  const list = listAddresses()
  return list[0] ?? null
}

/**
 * Salva endereço (cria novo ou atualiza existente). Dedup pelo matchKey;
 * em caso de match, mantém o id antigo e atualiza `lastUsedAt` + campos
 * que possam ter mudado (complemento, bairro etc).
 */
export function saveAddress(input: Omit<SavedAddress, 'id' | 'lastUsedAt'>): SavedAddress {
  const list = read()
  const key = matchKey(input)
  const existing = list.find((a) => matchKey(a) === key)
  const now = Date.now()

  let saved: SavedAddress
  if (existing) {
    saved = { ...existing, ...input, lastUsedAt: now }
    const next = list.map((a) => (a.id === existing.id ? saved : a))
    write(next)
  } else {
    saved = { ...input, id: genId(), lastUsedAt: now }
    // Limita o tamanho da lista — drop dos menos usados.
    const next = [saved, ...list]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_ADDRESSES)
    write(next)
  }
  return saved
}

export function removeAddress(id: string): void {
  const list = read()
  write(list.filter((a) => a.id !== id))
}

export function clearAddresses(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
