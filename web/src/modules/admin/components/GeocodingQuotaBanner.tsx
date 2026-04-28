import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { GeocodingUsage, useGeocodingUsage } from '../hooks/useGeocodingUsage'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

// Banner mostrado pro OWNER quando a cota mensal da Google Geocoding atinge
// 70%, 80%, 90% ou 100%. Persistência por sessionStorage e por threshold —
// reaparece ao mudar de faixa pra reforçar o aviso conforme aproxima do limite.
//
// Não-bloqueante: o sistema continua geocoding normalmente até a Google parar
// de responder. O objetivo é só dar visibilidade ao dono.

const DISMISS_KEY_PREFIX = 'geocoding-quota-banner-dismissed:'

type Severity = 'warn' | 'high' | 'critical' | 'exceeded'

interface BannerStyle {
  severity: Severity
  threshold: number
  bg: string
  border: string
  text: string
  buttonBg: string
}

function bannerForPercent(percent: number): BannerStyle | null {
  if (percent >= 100) {
    return {
      severity: 'exceeded',
      threshold: 100,
      bg: 'bg-red-700',
      border: 'border-red-900',
      text: 'text-white',
      buttonBg: 'bg-white text-red-700 hover:bg-red-50',
    }
  }
  if (percent >= 90) {
    return {
      severity: 'critical',
      threshold: 90,
      bg: 'bg-red-600',
      border: 'border-red-800',
      text: 'text-white',
      buttonBg: 'bg-white text-red-600 hover:bg-red-50',
    }
  }
  if (percent >= 80) {
    return {
      severity: 'high',
      threshold: 80,
      bg: 'bg-orange-500',
      border: 'border-orange-700',
      text: 'text-white',
      buttonBg: 'bg-white text-orange-600 hover:bg-orange-50',
    }
  }
  if (percent >= 70) {
    return {
      severity: 'warn',
      threshold: 70,
      bg: 'bg-yellow-400',
      border: 'border-yellow-600',
      text: 'text-yellow-950',
      buttonBg: 'bg-yellow-950 text-yellow-50 hover:bg-yellow-900',
    }
  }
  return null
}

function bannerMessage(usage: GeocodingUsage, severity: Severity): string {
  const used = usage.used.toLocaleString('pt-BR')
  const quota = usage.quota.toLocaleString('pt-BR')
  if (severity === 'exceeded') {
    return `Cota da Google Geocoding API esgotada (${used}/${quota}). Buscas de endereço podem falhar até a virada do mês.`
  }
  if (severity === 'critical') {
    return `Cota da Google Geocoding API em ${usage.percent}% (${used}/${quota}). Aumente o limite no Google Cloud antes que esgote.`
  }
  if (severity === 'high') {
    return `Cota da Google Geocoding API em ${usage.percent}% (${used}/${quota}). Risco de falhas em horário de pico.`
  }
  return `Cota da Google Geocoding API em ${usage.percent}% (${used}/${quota}) este mês.`
}

export function GeocodingQuotaBanner() {
  const role = useAuthStore((s) => s.user?.role)
  const isOwner = role === 'OWNER'

  const { data } = useGeocodingUsage(isOwner)

  const banner = data ? bannerForPercent(data.percent) : null
  const dismissKey = banner && data ? `${DISMISS_KEY_PREFIX}${data.month}:${banner.threshold}` : null
  const [dismissed, setDismissed] = useState(false)

  // Quando muda a faixa (ex: 70 → 80) ou vira o mês, re-checa sessionStorage.
  // Faixa nova → permanece visível mesmo que o usuário tenha dispensado a anterior.
  useEffect(() => {
    if (!dismissKey) {
      setDismissed(false)
      return
    }
    setDismissed(sessionStorage.getItem(dismissKey) === '1')
  }, [dismissKey])

  if (!isOwner || !banner || !data || !dismissKey || dismissed) return null

  function handleDismiss() {
    if (!dismissKey) return
    sessionStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div className={`sticky top-0 z-30 ${banner.bg} ${banner.text} shadow-md border-b-2 ${banner.border}`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium truncate">{bannerMessage(data, banner.severity)}</p>
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 ${banner.buttonBg} text-sm font-semibold px-2 py-1.5 rounded-md transition-colors`}
          aria-label="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
