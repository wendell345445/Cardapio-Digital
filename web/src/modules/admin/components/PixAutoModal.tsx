import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getPixAutoStatus, type PixAutoResponse } from '../services/billing.service'

import { toast } from '@/shared/lib/toast'

interface Props {
  data: PixAutoResponse
  onClose: () => void
}

// Status que indicam autorização concluída (débito recorrente ativo).
const ACTIVE_STATUSES = ['ACTIVE', 'ACTIVATED']

/**
 * Modal do fluxo PIX Automático: mostra o QR de autorização (imagem + copia-e-cola).
 * O lojista escaneia no app do banco, paga a 1ª cobrança e consente os débitos
 * recorrentes. Faz polling do status; ao ativar, invalida ['store'] e fecha.
 */
export function PixAutoModal({ data, onClose }: Props) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const activatedRef = useRef(false)

  // Polling do status enquanto o lojista paga/autoriza. O webhook é a fonte-de-verdade
  // pra ativar a loja; aqui só damos feedback visual e disparamos o refetch.
  useEffect(() => {
    if (activatedRef.current) return
    const id = setInterval(async () => {
      try {
        const res = await getPixAutoStatus()
        if (res.status && ACTIVE_STATUSES.includes(res.status.toUpperCase())) {
          activatedRef.current = true
          clearInterval(id)
          await qc.invalidateQueries({ queryKey: ['store'] })
          toast.success('Assinatura ativada!', 'Seu PIX Automático está configurado.')
          onClose()
        }
      } catch {
        // silencioso — segue tentando
      }
    }, 4000)
    return () => clearInterval(id)
  }, [qc, onClose])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(data.qrPayload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar', data.qrPayload)
    }
  }

  const qrSrc = data.qrImage.startsWith('data:') ? data.qrImage : `data:image/png;base64,${data.qrImage}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Assinar com PIX Automático</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600">
            Escaneie o QR abaixo no app do seu banco. Ao pagar a primeira cobrança você
            <strong> autoriza os débitos automáticos mensais</strong> — não precisa repetir todo mês.
          </p>

          <div className="flex justify-center">
            <img src={qrSrc} alt="QR Code PIX Automático" className="h-56 w-56 rounded-lg border border-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar código PIX (copia e cola)'}
          </button>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando autorização…
          </div>
        </div>
      </div>
    </div>
  )
}
