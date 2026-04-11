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
}

export interface ComandaOrder {
  id: string
  storeId: string
  tableId: string
  status: string
  createdAt: string
  items: ComandaItem[]
}

export interface TableWithComanda extends Table {
  orders: ComandaOrder[]
}

export interface Comanda {
  table: Table
  order: ComandaOrder | null
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

export interface QRCodeData {
  qrDataUrl: string
  url: string
  tableNumber: number
}

export interface CloseTableResult {
  tableNumber: number
  orderId: string
  itemCount: number
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
