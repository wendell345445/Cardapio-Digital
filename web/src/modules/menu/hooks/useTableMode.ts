import { useLocation } from 'react-router-dom'

import { useCartStore } from '../store/useCartStore'

const TABLE_FLAG_KEY = 'cardapio:table-active'

export function markTableModeActive() {
  try {
    sessionStorage.setItem(TABLE_FLAG_KEY, '1')
  } catch {
    /* sessionStorage indisponível (modo privado raro) — fluxo de mesa segue degradado */
  }
}

export function clearTableModeFlag() {
  try {
    sessionStorage.removeItem(TABLE_FLAG_KEY)
  } catch { /* noop */ }
}

function isTableModeFlagSet(): boolean {
  try {
    return sessionStorage.getItem(TABLE_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

interface TableMode {
  isTableMode: boolean
  tableNumber: number | null
  tableSessionToken: string | null
  deviceName: string | null
}

/**
 * Modo mesa só vale na aba que veio do QR (`/mesa/:token`). Em qualquer outra
 * aba/visita o store ainda persiste o token (pra reabrir o link da mesa
 * direto), mas o cardápio público trata como pedido online.
 */
export function useTableMode(): TableMode {
  const { pathname } = useLocation()
  const tableNumber = useCartStore((s) => s.tableNumber)
  const tableSessionToken = useCartStore((s) => s.tableSessionToken)
  const deviceName = useCartStore((s) => s.deviceName)

  const onTableEntry = pathname.startsWith('/mesa/')
  const active = onTableEntry || isTableModeFlagSet()
  const hasSession = !!(tableNumber && tableSessionToken)

  if (!active || !hasSession) {
    return {
      isTableMode: false,
      tableNumber: null,
      tableSessionToken: null,
      deviceName: null,
    }
  }

  return {
    isTableMode: true,
    tableNumber,
    tableSessionToken,
    deviceName,
  }
}
