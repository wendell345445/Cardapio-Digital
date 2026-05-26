import { FormEvent, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCartStore } from '../store/useCartStore'
import { useMenu } from '../hooks/useMenu'
import { getCustomerName, saveCustomerName } from '../lib/customerName'
import { getCustomerWhatsapp, saveCustomerWhatsapp } from '../lib/customerWhatsapp'
import { useTableMode } from '../hooks/useTableMode'
import { ThemeInjector } from '../components/ThemeInjector'
import { PageHeader } from '../components/PageHeader'

import { useStoreSlug } from '@/hooks/useStoreSlug'

// O número do WhatsApp aparece como campo na tela só pra alinhar visualmente
// com o protótipo MenuPanda. NÃO é persistido no localStorage nem enviado
// pro backend — TASK-130 removeu a captura de WhatsApp do fluxo público.
// O número real vem depois via opt-in WhatsApp inbound.
const formatBrazilianWhatsapp = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function IdentifiquesePage() {
  const navigate = useNavigate()
  const slug = useStoreSlug()
  const { data: menu } = useMenu(slug)
  const items = useCartStore((s) => s.items)
  const { tableNumber, deviceName } = useTableMode()
  const whatsappId = useId()
  const fullNameId = useId()

  const [formData, setFormData] = useState({
    whatsapp: getCustomerWhatsapp(),
    fullName: getCustomerName(),
  })

  // Em mesa, o nome já foi capturado no entry-point (`/mesa/:token`) — pula
  // direto pra checkout. Cart vazio também redireciona pra home.
  useEffect(() => {
    if (tableNumber && deviceName) {
      navigate('/checkout', { replace: true })
    } else if (items.length === 0) {
      navigate('/', { replace: true })
    }
  }, [tableNumber, deviceName, items.length, navigate])

  const whatsappDigits = onlyDigits(formData.whatsapp)
  // WhatsApp é cosmético — válido se vazio ou se tiver 11 dígitos com 9 na 3ª posição.
  const isWhatsappValid =
    whatsappDigits.length === 0 ||
    (whatsappDigits.length === 11 && whatsappDigits[2] === '9')
  const canContinue = isWhatsappValid && formData.fullName.trim().length > 0

  const handleBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate('/carrinho')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canContinue) return
    saveCustomerName(formData.fullName)
    // WhatsApp é cosmético (TASK-130) — só guardamos pra o campo não resetar
    // quando o cliente vai e volta entre telas no mesmo browser.
    saveCustomerWhatsapp(formData.whatsapp)
    navigate('/checkout')
  }

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-menu-bg [font-family:'Sen',Helvetica] antialiased text-menu-text">
      <ThemeInjector
        primaryColor={menu?.store.primaryColor}
        secondaryColor={menu?.store.secondaryColor}
      />
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[768px] flex-col bg-menu-bg px-4 sm:px-6 md:px-8"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        <PageHeader title="Identifique-se" onBack={handleBack} />

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col pt-8">
          <section
            className="rounded-[24px] bg-white px-4 py-5 shadow-[0_7px_24px_rgba(64,57,57,0.06)]"
            style={{ border: '0.6px solid rgba(65, 57, 57, 0.09)' }}
            aria-label="Dados de identificação"
          >
            <div className="space-y-4">
              <label htmlFor={whatsappId} className="block">
                <span className="mb-2 block text-[13px] font-semibold leading-[17px] tracking-[-0.18px] text-menu-text">
                  Qual seu número WhatsApp?
                </span>
                <input
                  id={whatsappId}
                  name="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData((c) => ({
                      ...c,
                      whatsapp: formatBrazilianWhatsapp(e.target.value),
                    }))
                  }
                  placeholder="Ex: (38) 99999-9999"
                  maxLength={15}
                  className="h-[46px] w-full rounded-[16px] bg-[#faf8f8] px-3 text-[14px] font-medium leading-[18px] text-menu-text outline-none placeholder:text-[#aaa0a0]"
                  style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
                />
                {formData.whatsapp && !isWhatsappValid && (
                  <span className="mt-1.5 block text-[10px] font-normal leading-[13px] tracking-[-0.06px] text-menu-primary">
                    Informe DDD + número com 9 dígitos.
                  </span>
                )}
              </label>

              <label htmlFor={fullNameId} className="block">
                <span className="mb-2 block text-[13px] font-semibold leading-[17px] tracking-[-0.18px] text-menu-text">
                  Seu nome e sobrenome
                </span>
                <input
                  id={fullNameId}
                  name="fullName"
                  type="text"
                  inputMode="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((c) => ({ ...c, fullName: e.target.value }))
                  }
                  placeholder="Ex: Márcio Silva"
                  className="h-[46px] w-full rounded-[16px] bg-[#faf8f8] px-3 text-[14px] font-medium leading-[18px] text-menu-text outline-none placeholder:text-[#aaa0a0]"
                  style={{ border: '0.6px solid rgba(65, 57, 57, 0.13)', fontSize: 16 }}
                />
              </label>

              <button
                type="submit"
                disabled={!canContinue}
                className={`mt-2 flex h-12 w-full items-center justify-center rounded-full px-4 text-[15px] font-bold leading-[19px] transition-all duration-200 active:scale-[0.99] ${
                  canContinue
                    ? 'bg-menu-primary text-white shadow-menu-lg'
                    : 'bg-[#f0eaea] text-[#9b9292]'
                }`}
              >
                Avançar
              </button>

              <p className="mt-1 text-[11px] font-normal leading-[13px] tracking-[-0.06px] text-menu-text-soft">
                Para realizar esse pedido, precisamos de algumas informações. Este é um ambiente
                protegido.
              </p>
            </div>
          </section>
        </form>
      </div>
    </main>
  )
}
