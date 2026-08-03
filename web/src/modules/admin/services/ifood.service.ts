import { api } from '@/shared/lib/api'

export interface IFoodConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTED'
  merchantId: string | null
  merchantName: string | null
  connectedAt: string | null
}

export interface IFoodMerchantPreview {
  id: string
  name: string
  corporateName: string | null
  city: string | null
  state: string | null
}

export async function getIFoodStatus(): Promise<IFoodConnectionStatus> {
  const { data } = await api.get<{ data: IFoodConnectionStatus }>('/admin/ifood/status')
  return data.data
}

/** Valida o merchantId que o lojista informou e devolve os dados pra conferência. */
export async function previewIFoodMerchant(merchantId: string): Promise<IFoodMerchantPreview> {
  const { data } = await api.post<{ data: IFoodMerchantPreview }>('/admin/ifood/merchant/preview', {
    merchantId,
  })
  return data.data
}

export async function linkIFoodMerchant(merchantId: string): Promise<IFoodConnectionStatus> {
  const { data } = await api.put<{ data: IFoodConnectionStatus }>('/admin/ifood/merchant', { merchantId })
  return data.data
}

export async function disconnectIFood(): Promise<void> {
  await api.delete('/admin/ifood')
}

export interface CatalogImportPreview {
  categories: number
  products: number
  addonCategories: number
  addons: number
  warnings: string[]
}

export async function previewCatalogImport(): Promise<CatalogImportPreview> {
  const { data } = await api.get<{ data: CatalogImportPreview }>('/admin/ifood/catalog/preview')
  return data.data
}

export async function applyCatalogImport(): Promise<CatalogImportPreview> {
  const { data } = await api.post<{ data: CatalogImportPreview }>('/admin/ifood/catalog/import')
  return data.data
}
