import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { fetchCep } from '../useViaCep'

describe('fetchCep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns address fields from a successful ViaCEP response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: '88010-000',
        logradouro: 'Praça XV de Novembro',
        bairro: 'Centro',
        localidade: 'Florianópolis',
        uf: 'SC',
      }),
    })

    const result = await fetchCep('88010000')

    expect(result).toEqual({
      street: 'Praça XV de Novembro',
      neighborhood: 'Centro',
      city: 'Florianópolis',
      state: 'SC',
    })
    expect(global.fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/88010000/json/')
  })

  it('strips non-digit characters from the input CEP before requesting', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'X',
        bairro: 'Y',
        localidade: 'Z',
        uf: 'SP',
      }),
    })

    await fetchCep('01310-100')
    expect(global.fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/')
  })

  it('throws when CEP has fewer than 8 digits', async () => {
    await expect(fetchCep('123')).rejects.toThrow('CEP inválido')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws when ViaCEP returns erro: true', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    })

    await expect(fetchCep('00000000')).rejects.toThrow('CEP não encontrado')
  })

  it('throws when fetch returns a non-ok response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchCep('88010000')).rejects.toThrow('Falha ao consultar ViaCEP')
  })
})
