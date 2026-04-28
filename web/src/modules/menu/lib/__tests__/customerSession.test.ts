import { describe, it, expect, beforeEach, vi } from 'vitest'

import { getCustomerSessionId, resetCustomerSessionId } from '../customerSession'

beforeEach(() => {
  window.localStorage.clear()
})

describe('customerSession', () => {
  it('gera UUID novo na primeira chamada e persiste', () => {
    const id = getCustomerSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(window.localStorage.getItem('mp_customer_session_id')).toBe(id)
  })

  it('retorna o mesmo id em chamadas subsequentes', () => {
    const a = getCustomerSessionId()
    const b = getCustomerSessionId()
    expect(a).toBe(b)
  })

  it('regenera id quando localStorage tem valor inválido', () => {
    window.localStorage.setItem('mp_customer_session_id', 'lixo')
    const id = getCustomerSessionId()
    expect(id).not.toBe('lixo')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/)
  })

  it('reset apaga o id do localStorage', () => {
    const id1 = getCustomerSessionId()
    resetCustomerSessionId()
    expect(window.localStorage.getItem('mp_customer_session_id')).toBeNull()
    const id2 = getCustomerSessionId()
    expect(id2).not.toBe(id1)
  })

  it('sobrevive a localStorage bloqueado (modo privado)', () => {
    const original = window.localStorage.setItem
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const id = getCustomerSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/)
    window.localStorage.setItem = original
  })
})
