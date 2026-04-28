import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  listAddresses,
  lastUsedAddress,
  saveAddress,
  removeAddress,
  clearAddresses,
} from '../customerAddresses'

beforeEach(() => {
  window.localStorage.clear()
})

const baseInput = {
  zipCode: '01310-100',
  street: 'Av. Paulista',
  number: '1000',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

describe('customerAddresses', () => {
  it('listAddresses retorna [] quando vazio', () => {
    expect(listAddresses()).toEqual([])
    expect(lastUsedAddress()).toBeNull()
  })

  it('saveAddress cria e persiste com id e lastUsedAt', () => {
    const saved = saveAddress(baseInput)
    expect(saved.id).toMatch(/^[0-9a-f-]{8,}/i)
    expect(saved.lastUsedAt).toBeGreaterThan(0)

    const list = listAddresses()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject(baseInput)
  })

  it('lastUsedAddress retorna o mais recente', async () => {
    saveAddress(baseInput)
    await new Promise((r) => setTimeout(r, 5))
    const second = saveAddress({
      ...baseInput,
      street: 'Outra rua',
      number: '50',
    })
    expect(lastUsedAddress()?.id).toBe(second.id)
  })

  it('saveAddress dedup pelo (cep+rua+numero) e atualiza lastUsedAt', async () => {
    const first = saveAddress(baseInput)
    const t1 = first.lastUsedAt

    await new Promise((r) => setTimeout(r, 5))
    // Mesmo cep+rua+numero, complemento diferente — deve atualizar o existente.
    const second = saveAddress({ ...baseInput, complement: 'Apto 101' })

    expect(second.id).toBe(first.id)
    expect(second.lastUsedAt).toBeGreaterThan(t1)
    expect(second.complement).toBe('Apto 101')
    expect(listAddresses()).toHaveLength(1)
  })

  it('dedup é case-insensitive em rua/numero', () => {
    saveAddress({ ...baseInput, street: 'Av. Paulista', number: '1000' })
    saveAddress({ ...baseInput, street: 'AV. PAULISTA', number: '1000' })
    expect(listAddresses()).toHaveLength(1)
  })

  it('CEP normaliza removendo máscara', () => {
    saveAddress({ ...baseInput, zipCode: '01310-100' })
    saveAddress({ ...baseInput, zipCode: '01310100' })
    expect(listAddresses()).toHaveLength(1)
  })

  it('limita a 10 endereços, descartando o menos usado', async () => {
    for (let i = 0; i < 12; i++) {
      saveAddress({ ...baseInput, street: `Rua ${i}`, number: String(i) })
      await new Promise((r) => setTimeout(r, 1))
    }
    const list = listAddresses()
    expect(list).toHaveLength(10)
    // Os mais recentes ficaram (Rua 11 mais novo)
    expect(list[0].street).toBe('Rua 11')
    expect(list[list.length - 1].street).toBe('Rua 2')
  })

  it('removeAddress tira da lista', () => {
    const saved = saveAddress(baseInput)
    expect(listAddresses()).toHaveLength(1)
    removeAddress(saved.id)
    expect(listAddresses()).toEqual([])
  })

  it('clearAddresses zera tudo', () => {
    saveAddress(baseInput)
    saveAddress({ ...baseInput, street: 'B', number: '2' })
    clearAddresses()
    expect(listAddresses()).toEqual([])
  })

  it('ignora valores inválidos no localStorage', () => {
    window.localStorage.setItem('mp_customer_addresses', 'lixo')
    expect(listAddresses()).toEqual([])

    window.localStorage.setItem('mp_customer_addresses', JSON.stringify([{ id: 'x' }]))
    expect(listAddresses()).toEqual([])
  })

  it('sobrevive a localStorage bloqueado', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => saveAddress(baseInput)).not.toThrow()
  })
})
