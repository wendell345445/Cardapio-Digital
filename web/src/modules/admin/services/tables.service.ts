import { api } from '@/shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Table {
  id: string
  storeId: string
  number: number
  isOccupied: boolean
  createdAt: string
}

export interface OrderItemAdditional {
  id: string
  name: string
  price: number
}

export interface ComandaItem {
  id: string
  orderId: string
  productId: string
  productName: string
  variationName: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  notes: string | null
  status: 'PENDING' | 'PREPARING' | 'DELIVERED'
  additionals: OrderItemAdditional[]
  /** Nome do dispositivo que pediu o item dentro da sessão da mesa */
  deviceName?: string | null
}

export interface ComandaOrder {
  id: string
  storeId?: string
  tableId?: string
  status?: string
  createdAt: string
  number?: number
  deviceName?: string | null
  items?: ComandaItem[]
}

export interface TableSessionSummary {
  id: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  /** True quando todos os pedidos não-cancelados da sessão têm paymentReceivedAt */
  isPaid: boolean
  /** Quando o cliente clicou "Pedir conta" no /comanda. Null = não pediu ainda. */
  checkRequestedAt: string | null
  orders: ComandaOrder[]
}

export type TablePaymentMethod = 'PIX' | 'CASH' | 'CREDIT' | 'DEBIT'

export interface ConfirmTablePaymentResult {
  sessionId: string
  ordersPaid: number
  paymentMethod: TablePaymentMethod
  alreadyPaid: boolean
}

export interface TableWithComanda extends Table {
  orders: ComandaOrder[]
  sessions: TableSessionSummary[]
}

export interface Comanda {
  table: Table
  session: {
    id: string
    openedAt: string
    isPaid: boolean
    paymentMethod: TablePaymentMethod | null
    checkRequestedAt: string | null
  } | null
  orders: ComandaOrder[]
  items: ComandaItem[]
  subtotal: number
  total: number
}

export interface CreateTableDto {
  number: number
}

export interface CloseTableDto {
  applyServiceCharge?: boolean
  serviceChargePercent?: number
}

export interface SettleTableDto {
  paymentMethod: TablePaymentMethod
  applyServiceCharge?: boolean
  serviceChargePercent?: number
}

export interface SettleTableResult {
  tableNumber: number
  sessionId: string
  ordersClosed: number
  ordersPaid: number
  paymentMethod: TablePaymentMethod
  subtotal: number
  serviceCharge: number
  total: number
}

export interface QRCodeData {
  qrDataUrl: string
  url: string
  tableNumber: number
}

export interface CloseTableResult {
  tableNumber: number
  sessionId: string
  ordersClosed: number
  subtotal: number
  serviceCharge: number
  total: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchTables(): Promise<TableWithComanda[]> {
  const { data } = await api.get('/admin/tables')
  return data.data
}

export async function createTable(dto: CreateTableDto): Promise<Table> {
  const { data } = await api.post('/admin/tables', dto)
  return data.data
}

export async function fetchQRCode(id: string): Promise<QRCodeData> {
  const { data } = await api.get(`/admin/tables/${id}/qrcode`)
  return data.data
}

export async function downloadQRCodePDF(id: string, tableNumber: number): Promise<void> {
  const response = await api.get(`/admin/tables/${id}/qrcode/pdf`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `mesa-${tableNumber}-qrcode.pdf`)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function closeTable(id: string, dto: CloseTableDto): Promise<CloseTableResult> {
  const { data } = await api.patch(`/admin/tables/${id}/close`, dto)
  return data.data
}

export async function fetchComanda(id: string): Promise<Comanda> {
  const { data } = await api.get(`/admin/tables/${id}/comanda`)
  return data.data
}

export async function updateItemStatus(
  tableId: string,
  itemId: string,
  status: 'PENDING' | 'PREPARING' | 'DELIVERED'
): Promise<ComandaItem> {
  const { data } = await api.patch(`/admin/tables/${tableId}/items/${itemId}/status`, { status })
  return data.data
}

export async function setTablesCount(count: number): Promise<TableWithComanda[]> {
  const { data } = await api.put('/admin/tables/count', { count })
  return data.data
}

export async function downloadAllQRCodesPDF(): Promise<void> {
  const response = await api.get('/admin/tables/qrcode/pdf-all', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'mesas-qrcodes.pdf')
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function confirmTablePayment(
  tableId: string,
  paymentMethod: TablePaymentMethod
): Promise<ConfirmTablePaymentResult> {
  const { data } = await api.post(`/admin/tables/${tableId}/payment`, { paymentMethod })
  return data.data
}

export async function settleTable(tableId: string, dto: SettleTableDto): Promise<SettleTableResult> {
  const { data } = await api.post(`/admin/tables/${tableId}/settle`, dto)
  return data.data
}

export interface ClosedSessionEntry {
  id: string
  tableNumber: number
  openedAt: string
  closedAt: string
  ordersCount: number
  subtotal: number
  paymentMethod: TablePaymentMethod | null
  deviceNames: string[]
}

export async function fetchClosedSessions(params?: {
  from?: string
  to?: string
}): Promise<ClosedSessionEntry[]> {
  const { data } = await api.get('/admin/tables/sessions/history', { params })
  return data.data
}
