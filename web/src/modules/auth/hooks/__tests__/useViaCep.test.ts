import { describe, it, expect, vi, beforeEach } from 'vitest'

import { fetchCep } from '../useViaCep'

import { api } from '@/shared/lib/api'

vi.mock('@/shared/lib/api', () => ({
  api: { post: vi.fn() },
}))

const mockedPost = api.post as unknown as ReturnType<typeof vi.fn>

describe('fetchCep (backend /cep/lookup)', () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it('retorna campos do backend quando lookup bem-sucedido', async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          cep: '88010000',
          street: 'Praça XV de Novembro',
          neighborhood: 'Centro',
          city: 'Florianópolis',
          state: 'SC',
          source: 'google',
        },
      },
    })

    const result = await fetchCep('88010000')

    expect(result).toEqual({
      street: 'Praça XV de Novembro',
      neighborhood: 'Centro',
      city: 'Florianópolis',
      state: 'SC',
    })
    expect(mockedPost).toHaveBeenCalledWith('/cep/lookup', { cep: '88010000' })
  })

  it('normaliza CEP removendo caracteres não-dígitos antes de enviar', async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, data: { cep: '01310100', street: 'X', neighborhood: 'Y', city: 'Z', state: 'SP', source: 'google' } },
    })

    await fetchCep('01310-100')
    expect(mockedPost).toHaveBeenCalledWith('/cep/lookup', { cep: '01310100' })
  })

  it('lança quando CEP tem menos de 8 dígitos (validação local, sem chamar backend)', async () => {
    await expect(fetchCep('123')).rejects.toThrow('CEP inválido')
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('lança quando backend retorna 422 (CEP não encontrado)', async () => {
    mockedPost.mockRejectedValue({
      response: { status: 422, data: { success: false, error: 'CEP não encontrado' } },
    })

    await expect(fetchCep('00000000')).rejects.toThrow('CEP não encontrado')
  })

  it('lança "Falha ao consultar CEP" quando backend está fora do ar', async () => {
    mockedPost.mockRejectedValue(new Error('Network Error'))
    await expect(fetchCep('88010000')).rejects.toThrow('Falha ao consultar CEP')
  })
})
