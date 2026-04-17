import { useState, useCallback, useEffect } from 'react'

import {
  checkCustomer,
  requestOtp,
  verifyOtp,
  getCustomerMe,
  logoutCustomer,
} from '../services/customer-verify.service'
import type { CheckCustomerResult, CustomerMeResult } from '../services/customer-verify.service'

type Step = 'loading' | 'phone' | 'otp' | 'verified'

interface UseCustomerAuthReturn {
  step: Step
  whatsapp: string
  customerData: CustomerMeResult | null
  error: string | null
  otpSent: boolean
  otpCountdown: number
  setWhatsapp: (v: string) => void
  submitPhone: () => Promise<void>
  submitOtp: (code: string) => Promise<void>
  resendOtp: () => Promise<void>
  reset: () => void
}

export function useCustomerAuth(): UseCustomerAuthReturn {
  const [step, setStep] = useState<Step>('loading')
  const [whatsapp, setWhatsapp] = useState('')
  const [customerData, setCustomerData] = useState<CustomerMeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)

  // Tenta ler cookie existente ao abrir
  useEffect(() => {
    let cancelled = false
    getCustomerMe()
      .then((data) => {
        if (cancelled) return
        setCustomerData(data)
        setWhatsapp(data.whatsapp)
        setStep('verified')
      })
      .catch(() => {
        if (cancelled) return
        setStep('phone')
      })
    return () => { cancelled = true }
  }, [])

  // Countdown para reenvio do OTP
  useEffect(() => {
    if (otpCountdown <= 0) return
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [otpCountdown])

  const submitPhone = useCallback(async () => {
    setError(null)
    if (whatsapp.length !== 11) {
      setError('WhatsApp deve ter 11 dígitos (com DDD)')
      return
    }

    try {
      const result: CheckCustomerResult = await checkCustomer(whatsapp)
      if (result.exists) {
        // Cliente existente — cookie setado pelo backend, preenche dados
        setCustomerData({ whatsapp, name: result.name, address: result.address })
        setStep('verified')
      } else {
        // Cliente novo — envia OTP
        await requestOtp(whatsapp)
        setOtpSent(true)
        setOtpCountdown(60)
        setStep('otp')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao verificar número')
    }
  }, [whatsapp])

  const submitOtp = useCallback(async (code: string) => {
    setError(null)
    try {
      await verifyOtp(whatsapp, code)
      // Verificado — busca dados se houver
      try {
        const me = await getCustomerMe()
        setCustomerData(me)
      } catch {
        setCustomerData({ whatsapp, name: null, address: null })
      }
      setStep('verified')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Código incorreto')
    }
  }, [whatsapp])

  const resendOtp = useCallback(async () => {
    setError(null)
    try {
      await requestOtp(whatsapp)
      setOtpCountdown(60)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao reenviar código')
    }
  }, [whatsapp])

  const reset = useCallback(() => {
    logoutCustomer().catch(() => {})
    setStep('phone')
    setWhatsapp('')
    setCustomerData(null)
    setError(null)
    setOtpSent(false)
    setOtpCountdown(0)
  }, [])

  return {
    step,
    whatsapp,
    customerData,
    error,
    otpSent,
    otpCountdown,
    setWhatsapp,
    submitPhone,
    submitOtp,
    resendOtp,
    reset,
  }
}
