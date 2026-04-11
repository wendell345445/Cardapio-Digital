import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react'

import { api } from '@/shared/lib/api'

// ─── TASK-111: WhatsApp Config Tab (QRCode extraído de WhatsAppPage) ──────────

async function fetchWhatsAppStatus() {
  const { data } = await api.get('/admin/whatsapp/qrcode')
  return data.data as { qrCode: string | null; isConnected: boolean; isReconnecting?: boolean }
}

async function disconnectWhatsApp() {
  await api.delete('/admin/whatsapp')
}

export function WhatsAppConfigTab() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: fetchWhatsAppStatus,
    refetchInterval: (query) => query.state.data?.isConnected ? 10_000 : 2_000,
  })

  const disconnect = useMutation({
    mutationFn: disconnectWhatsApp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp-status'] }),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            data?.isConnected
              ? 'bg-green-100 text-green-700'
              : data?.isReconnecting
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {data?.isConnected ? (
            <>
              <Wifi size={14} /> Conectado
            </>
          ) : data?.isReconnecting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Conectando...
            </>
          ) : (
            <>
              <WifiOff size={14} /> Desconectado
            </>
          )}
        </div>
      </div>

      {data?.isConnected ? (
        <div className="bg-green-50 rounded-xl p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <Wifi size={32} className="text-white" />
          </div>
          <p className="text-green-700 font-semibold">WhatsApp conectado!</p>
          <p className="text-sm text-green-600">Notificações automáticas estão ativas.</p>
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="flex items-center gap-2 mx-auto text-sm text-red-500 hover:text-red-700"
          >
            <Trash2 size={16} /> Desconectar
          </button>
        </div>
      ) : data?.isReconnecting ? (
        <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <div className="text-center py-8">
            <Loader2 size={32} className="animate-spin text-yellow-500 mx-auto mb-3" />
            <p className="text-yellow-700 font-medium">Restaurando sessão...</p>
            <p className="text-sm text-gray-500 mt-1">Isso leva alguns segundos.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : data?.qrCode ? (
            <>
              <p className="text-center text-gray-600 text-sm">
                Abra o WhatsApp no celular → Dispositivos Vinculados → Vincular dispositivo → Escaneie o QR Code abaixo:
              </p>
              <div className="flex justify-center">
                <img src={data.qrCode} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg border" />
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">Gerando QR Code...</div>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      )}

      <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-700">
        <p className="font-semibold mb-1">Importante</p>
        <p>
          Após escanear, mantenha o celular conectado à internet. A sessão é restaurada automaticamente após reinícios
          do servidor.
        </p>
      </div>
    </div>
  )
}
