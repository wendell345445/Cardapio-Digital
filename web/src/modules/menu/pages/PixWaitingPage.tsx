import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Copy, Check } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'

import { OrderSentAnimation } from '../components/OrderSentAnimation'
import { ThemeInjector } from '../components/ThemeInjector'

import { createPublicApi } from '@/shared/lib/publicApi'

const menuApi = createPublicApi()

async function fetchOrderTracking(token: string) {
  const { data } = await menuApi.get(`/menu/pedido/${token}`)
  return data.data
}

interface OrderCreatedState {
  pixQrCode?: string
  pixCopyPaste?: string
  pixKey?: string
  pixKeyType?: string
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PIX_KEY_TYPE_LABEL: Record<string, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  EVP: 'Chave aleatória',
}

export function PixWaitingPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [pixKeyCopied, setPixKeyCopied] = useState(false)
  const [copyPasteCopied, setCopyPasteCopied] = useState(false)

  const state = location.state as OrderCreatedState | null

  const { data: order } = useQuery({
    queryKey: ['order-tracking', token],
    queryFn: () => fetchOrderTracking(token!),
    staleTime: 30_000,
  })

  const handleCopyPixKey = async () => {
    const key = order?.store?.pixKey ?? state?.pixKey
    if (!key) return
    try {
      await navigator.clipboard.writeText(key)
      setPixKeyCopied(true)
      setTimeout(() => setPixKeyCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleCopyPixCopyPaste = async () => {
    if (!state?.pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(state.pixCopyPaste)
      setCopyPasteCopied(true)
      setTimeout(() => setCopyPasteCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleClose = () => {
    navigate(`/pedido/${token}`, { state, replace: true })
  }

  const pairedNumber = (order?.store?.whatsappPairedNumber ?? '').replace(/\D/g, '')
  const waMessage = order
    ? `Olá! Segue o comprovante do pagamento do pedido #${order.number}.`
    : ''
  const waLink = pairedNumber
    ? `https://wa.me/${pairedNumber}?text=${encodeURIComponent(waMessage)}`
    : null

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <ThemeInjector
        primaryColor={order?.store?.primaryColor}
        secondaryColor={order?.store?.secondaryColor}
      />
      <div className="mx-auto flex h-dvh w-full max-w-[420px] flex-col items-center px-5 py-3">
        <div className="origin-top scale-[0.65] sm:scale-75">
          <OrderSentAnimation />
        </div>

        <div className="-mt-8 flex items-center justify-center gap-1.5">
          <CheckCircle className="h-5 w-5 text-[#32a852]" />
          <h1 className="text-[20px] font-semibold leading-[24px] text-[#5f5a5a]">
            Pedido Enviado
          </h1>
        </div>

        {order && (
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.5px] text-menu-text">
            {fmt(order.total)}
          </p>
        )}
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.9px] text-[#9a8f8f]">
          Total do pedido
        </p>

        {state?.pixQrCode && (
          <img
            src={state.pixQrCode}
            alt="QR Code Pix"
            className="mt-2 h-36 w-36 rounded-lg"
          />
        )}

        {(order?.store?.pixKey || state?.pixKey) && (
          <div className="mt-2.5 w-full">
            {(order?.store?.pixKeyType || state?.pixKeyType) && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-menu-text-soft">
                Chave Pix ·{' '}
                {PIX_KEY_TYPE_LABEL[
                  (order?.store?.pixKeyType ?? state?.pixKeyType) as string
                ] ?? (order?.store?.pixKeyType ?? state?.pixKeyType)}
              </p>
            )}
            <div
              className="flex h-[40px] w-full items-center justify-between gap-2 rounded-[8px] bg-white px-3 shadow-[0_2px_8px_rgba(64,57,57,0.04)]"
              style={{ border: '0.6px solid rgba(65, 57, 57, 0.28)' }}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-menu-text">
                {order?.store?.pixKey ?? state?.pixKey}
              </span>
              <button
                type="button"
                onClick={handleCopyPixKey}
                aria-label="Copiar chave Pix"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-menu-text transition-opacity active:opacity-70"
              >
                <span>{pixKeyCopied ? 'Copiado' : 'Copiar Chave'}</span>
                {pixKeyCopied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}

        {state?.pixCopyPaste && (
          <div
            className="mt-2 flex h-[40px] w-full items-center justify-between gap-2 rounded-[8px] bg-white px-3 shadow-[0_2px_8px_rgba(64,57,57,0.04)]"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.28)' }}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-menu-text-soft">
              {state.pixCopyPaste}
            </span>
            <button
              type="button"
              onClick={handleCopyPixCopyPaste}
              aria-label="Copiar Pix copia e cola"
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-menu-text transition-opacity active:opacity-70"
            >
              <span>{copyPasteCopied ? 'Copiado' : 'Copia e Cola'}</span>
              {copyPasteCopied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        )}

        <div
          className="mt-2 w-full rounded-[8px] bg-[#e9f5fa] px-3 py-2"
          style={{ border: '0.6px solid rgba(61, 129, 158, 0.16)' }}
        >
          <p className="text-center text-[11px] leading-[16px] text-menu-text">
            Faça o pagamento via Pix no app do seu banco e nos encaminhe o comprovante para
            confirmação
          </p>
        </div>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] border border-menu-card-border bg-white py-2.5 text-sm font-semibold text-menu-text transition-colors active:scale-[0.98]"
          >
            <FaWhatsapp size={18} className="text-green-600" />
            Enviar Comprovante
          </a>
        )}

        <button
          type="button"
          onClick={handleClose}
          className="mt-1 w-full py-2 text-sm font-semibold text-menu-text-soft transition-opacity active:opacity-70"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
