import { describe, it, expect } from 'vitest'

import { getStatusConfig } from '../OrderTrackingPage'

// Regressão: status READY não estava mapeado em STATUS_CONFIG e caía no fallback
// step:0, zerando todo o stepper no cardápio público do cliente.

describe('getStatusConfig', () => {
  it('READY + DELIVERY → step 2 (mantém "Em preparo" como último check aceso)', () => {
    const cfg = getStatusConfig('READY', 'DELIVERY')
    expect(cfg.step).toBe(2)
    expect(cfg.label).toMatch(/motoboy/i)
  })

  it('READY + PICKUP → step 3 (pronto para retirada é o estado final antes de DELIVERED)', () => {
    const cfg = getStatusConfig('READY', 'PICKUP')
    expect(cfg.step).toBe(3)
    expect(cfg.label).toMatch(/retirada/i)
  })

  it('READY + TABLE → step 3', () => {
    const cfg = getStatusConfig('READY', 'TABLE')
    expect(cfg.step).toBe(3)
  })

  it('CONFIRMED → step 1, mantém label "Confirmado"', () => {
    expect(getStatusConfig('CONFIRMED', 'DELIVERY')).toMatchObject({ step: 1, label: 'Confirmado' })
  })

  it('PREPARING → step 2', () => {
    expect(getStatusConfig('PREPARING', 'DELIVERY').step).toBe(2)
  })

  it('DISPATCHED → step 3', () => {
    expect(getStatusConfig('DISPATCHED', 'DELIVERY').step).toBe(3)
  })

  it('DELIVERED → step 4', () => {
    expect(getStatusConfig('DELIVERED', 'DELIVERY').step).toBe(4)
  })

  it('status desconhecido → fallback com step 0', () => {
    const cfg = getStatusConfig('FOOBAR', 'DELIVERY')
    expect(cfg.step).toBe(0)
    expect(cfg.label).toBe('FOOBAR')
  })
})
