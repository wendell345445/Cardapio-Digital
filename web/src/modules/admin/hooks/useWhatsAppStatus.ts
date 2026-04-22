import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/api'

interface WhatsAppStatus {
  qrCode: string | null
  isConnected: boolean
}

async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  const { data } = await api.get('/admin/whatsapp/qrcode')
  return data.data
}

export function useWhatsAppStatus() {
  return useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: fetchWhatsAppStatus,
    refetchInterval: 30_000,
    retry: false,
  })
}
