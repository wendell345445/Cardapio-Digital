import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'

// ─── Storage key ──────────────────────────────────────────────────────────────

const CONSENT_KEY = 'cookie_consent'

// ─── Helper (exported for use elsewhere) ──────────────────────────────────────

/**
 * Returns true if the user has accepted or declined cookie consent.
 * Only returns true for explicit "accepted" consent.
 */
export function hasCookieConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

/**
 * Returns the stored consent value: 'accepted' | 'declined' | null
 */
export function getCookieConsentStatus(): 'accepted' | 'declined' | null {
  try {
    const val = localStorage.getItem(CONSENT_KEY)
    if (val === 'accepted' || val === 'declined') return val
    return null
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Sticky bottom cookie consent banner.
 * Only renders if no consent decision has been stored yet.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show banner only if user hasn't made a decision yet
    const status = getCookieConsentStatus()
    if (status === null) {
      setVisible(true)
    }
  }, [])

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted')
    } catch {
      // localStorage not available
    }
    setVisible(false)
  }

  function decline() {
    try {
      localStorage.setItem(CONSENT_KEY, 'declined')
    } catch {
      // localStorage not available
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-2xl bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-4 flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Cookie className="w-5 h-5 text-yellow-400" />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed text-gray-100">
            Usamos cookies para melhorar sua experiência. Ao continuar, você aceita nossa{' '}
            <a
              href="/politica-de-privacidade"
              className="underline text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              política de cookies
            </a>
            .
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={accept}
              className="px-4 py-1.5 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              Aceitar
            </button>
            <button
              onClick={decline}
              className="px-4 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Recusar
            </button>
          </div>
        </div>

        {/* Close (dismiss without decision) */}
        <button
          onClick={decline}
          aria-label="Fechar aviso de cookies"
          className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
