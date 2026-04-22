import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'

import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus'

const SNOOZE_KEY = 'whatsapp-offline-modal-snoozed-until'
const SNOOZE_MS = 10 * 60 * 1000 // 10 min

function isSnoozed(): boolean {
  const raw = localStorage.getItem(SNOOZE_KEY)
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return Date.now() < until
}

function snooze(): void {
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
}

export function WhatsAppOfflineAlert() {
  const { data, isLoading } = useWhatsAppStatus()
  const navigate = useNavigate()
  const location = useLocation()
  const [modalOpen, setModalOpen] = useState(false)

  const isOffline = !isLoading && data && !data.isConnected
  const onWhatsAppPage = location.pathname.startsWith('/admin/whatsapp')

  // Abre modal uma vez quando detectar offline (respeitando snooze).
  // Não abre se já está na página /admin/whatsapp (CTA redundante).
  useEffect(() => {
    if (isOffline && !onWhatsAppPage && !isSnoozed()) {
      setModalOpen(true)
    }
  }, [isOffline, onWhatsAppPage])

  // Title da aba com prefixo de alerta enquanto offline.
  useEffect(() => {
    if (!isOffline) return
    const original = document.title
    if (!original.startsWith('⚠')) {
      document.title = `⚠ WhatsApp offline — ${original}`
    }
    return () => { document.title = original }
  }, [isOffline])

  if (!isOffline) return null

  function goToWhatsApp() {
    setModalOpen(false)
    void navigate('/admin/whatsapp')
  }

  function snoozeModal() {
    snooze()
    setModalOpen(false)
  }

  return (
    <>
      {/* Banner sticky — sempre visível enquanto offline */}
      <div className="sticky top-0 z-30 bg-red-600 text-white shadow-md border-b-2 border-red-800">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <p className="text-sm font-medium truncate">
              WhatsApp desconectado — clientes não recebem confirmação de pedido nem código de verificação.
            </p>
          </div>
          {!onWhatsAppPage && (
            <button
              onClick={goToWhatsApp}
              className="flex-shrink-0 bg-white text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-1.5 rounded-md transition-colors"
            >
              Reconectar
            </button>
          )}
        </div>
      </div>

      {/* Modal bloqueante na primeira detecção (snoozable por 10min) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    WhatsApp desconectado
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Enquanto o WhatsApp da loja estiver fora do ar, seus clientes não conseguem:
                  </p>
                  <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Verificar o número pra finalizar pedido</li>
                    <li>Receber confirmação e atualizações do pedido</li>
                  </ul>
                  <p className="mt-3 text-sm text-gray-700 font-medium">
                    Escaneie o QR code agora pra restabelecer a conexão.
                  </p>
                </div>
                <button
                  onClick={snoozeModal}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={snoozeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Lembrar em 10 min
                </button>
                <button
                  onClick={goToWhatsApp}
                  className="px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 rounded-md"
                >
                  Conectar agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
