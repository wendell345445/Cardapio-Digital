/**
 * Testes unitários dos providers do módulo geo (Photon/Nominatim/OSRM).
 *
 * Mock strategy:
 *   - geo.client.ts importa `fetch` e `Agent` de 'undici'. Mockamos o módulo
 *     'undici' inteiro pra capturar as URLs chamadas e devolver respostas
 *     fake — sem rede real. Não tocamos os providers, só o transporte.
 */

/* eslint-disable import/order */
import { jest } from '@jest/globals'

jest.mock('undici', () => ({
  fetch: jest.fn(),
  Agent: jest.fn().mockImplementation(() => ({})),
}))

// O jest.mock acima é hoisted — precisa vir ANTES dos imports do undici.
// Por isso desabilitamos import/order só neste arquivo.
import { fetch as undiciFetch } from 'undici'
import * as photon from '../providers/photon.provider'
import * as nominatim from '../providers/nominatim.provider'
import * as osrm from '../providers/osrm.provider'
import { __resetGeoAgentForTests } from '../geo.client'
/* eslint-enable import/order */

// Mock fetch tipado como `any` localizado: o tipo Response do DOM (lib.dom)
// é incompatível com undici.Response (ambos válidos em runtime, mas o TS
// reclama). Aceitar `any` aqui é o trade-off comum em testes de mock.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = undiciFetch as unknown as jest.MockedFunction<(...args: any[]) => any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonOk(body: unknown): any {
  return { ok: true, status: 200, json: async () => body }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonFail(status: number): any {
  return { ok: false, status, json: async () => ({}) }
}

beforeAll(() => {
  process.env.GEO_API_KEY = 'test-key'
  process.env.GEO_AUTOCOMPLETE_URL = 'https://geo.test/photon'
  process.env.GEO_GEOCODING_URL = 'https://geo.test/nominatim'
  process.env.GEO_ROUTING_URL = 'https://geo.test/osrm'
  // Path inexistente força fallback pro base64; ENVs base64 abaixo evitam erro.
  delete process.env.GEO_CLIENT_CERT_PATH
  delete process.env.GEO_CLIENT_KEY_PATH
  process.env.GEO_CLIENT_CERT_B64 = Buffer.from('fake-cert').toString('base64')
  process.env.GEO_CLIENT_KEY_B64 = Buffer.from('fake-key').toString('base64')
})

beforeEach(() => {
  mockFetch.mockReset()
  __resetGeoAgentForTests()
})

// ─── Photon ─────────────────────────────────────────────────────────────────

describe('photon.autocomplete', () => {
  it('retorna lista filtrada por BR + mapeia campos', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-46.66, -23.56] },
            properties: {
              name: 'Avenida Paulista',
              city: 'São Paulo',
              state: 'São Paulo',
              postcode: '01310-100',
              countrycode: 'BR',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-9.13, 38.71] },
            properties: { name: 'Lisboa', countrycode: 'PT' },
          },
        ],
      })
    )
    const res = await photon.autocomplete('avenida paulista')
    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Avenida Paulista')
    expect(res[0].postcode).toBe('01310-100')
    expect(res[0].latitude).toBe(-23.56)
    expect(res[0].longitude).toBe(-46.66)
  })

  it('retorna vazio quando query tem menos de 3 chars', async () => {
    const res = await photon.autocomplete('av')
    expect(res).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('usa lang=default (NÃO pt) — Photon recusa pt com 406', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk({ type: 'FeatureCollection', features: [] }))
    await photon.autocomplete('paulista')
    const calledUrl = String(mockFetch.mock.calls[0][0])
    expect(calledUrl).toContain('lang=default')
    expect(calledUrl).not.toContain('lang=pt')
  })

  it('inclui bias geográfico quando lat/lon fornecidos', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk({ type: 'FeatureCollection', features: [] }))
    await photon.autocomplete('rua', { lat: -23.5, lon: -46.6 })
    const calledUrl = String(mockFetch.mock.calls[0][0])
    expect(calledUrl).toContain('lat=-23.5')
    expect(calledUrl).toContain('lon=-46.6')
  })
})

// ─── Nominatim ──────────────────────────────────────────────────────────────

describe('nominatim.search', () => {
  it('parseia lat/lon + componentes + postcode', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonOk([
        {
          lat: '-23.5614',
          lon: '-46.6566',
          display_name: 'Avenida Paulista, 1578, São Paulo',
          address: {
            road: 'Avenida Paulista',
            house_number: '1578',
            suburb: 'Bela Vista',
            city: 'São Paulo',
            state: 'São Paulo',
            postcode: '01310-200',
          },
        },
      ])
    )
    const res = await nominatim.search({ q: 'avenida paulista 1578' })
    expect(res).not.toBeNull()
    expect(res!.latitude).toBe(-23.5614)
    expect(res!.street).toBe('Avenida Paulista')
    expect(res!.number).toBe('1578')
    expect(res!.postcode).toBe('01310-200')
  })

  it('retorna null quando Nominatim devolve array vazio', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk([]))
    const res = await nominatim.search({ q: 'endereço inexistente' })
    expect(res).toBeNull()
  })

  it('monta query a partir de componentes quando q ausente', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk([]))
    await nominatim.search({ street: 'Rua X', number: '10', city: 'SP' })
    const calledUrl = String(mockFetch.mock.calls[0][0])
    expect(calledUrl).toContain('q=Rua+X+10%2C+SP%2C+Brasil')
  })

  it('força countrycodes=br + accept-language=pt-BR + format=json', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk([]))
    await nominatim.search({ q: 'teste' })
    const calledUrl = String(mockFetch.mock.calls[0][0])
    expect(calledUrl).toContain('countrycodes=br')
    expect(calledUrl).toContain('accept-language=pt-BR')
    expect(calledUrl).toContain('format=json')
  })
})

describe('nominatim.reverse', () => {
  it('retorna endereço com CEP quando OSM mapeou', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonOk({
        lat: '-23.5614',
        lon: '-46.6566',
        display_name: 'MASP, 1578, Avenida Paulista, São Paulo',
        address: {
          road: 'Avenida Paulista',
          house_number: '1578',
          city: 'São Paulo',
          state: 'São Paulo',
          postcode: '01310-200',
        },
      })
    )
    const res = await nominatim.reverse(-23.5614, -46.6566)
    expect(res.displayName).toContain('MASP')
    expect(res.postcode).toBe('01310-200')
  })

  it('lança AppError quando reverse não tem display_name', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk({ lat: '0', lon: '0' }))
    await expect(nominatim.reverse(0, 0)).rejects.toThrow(/não encontrado/i)
  })
})

// ─── OSRM ───────────────────────────────────────────────────────────────────

describe('osrm.route', () => {
  it('converte distance(m)+duration(s) pra km+min arredondados', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonOk({ code: 'Ok', routes: [{ distance: 6338.8, duration: 696.5 }] })
    )
    const res = await osrm.route({
      from: { latitude: -23.5614, longitude: -46.6566 },
      to: { latitude: -23.567, longitude: -46.6919 },
    })
    expect(res.distanceKm).toBe(6.34)
    expect(res.durationMin).toBe(12)
  })

  it('lança AppError quando OSRM responde code != "Ok"', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk({ code: 'NoRoute', message: 'sem rota' }))
    await expect(
      osrm.route({
        from: { latitude: 0, longitude: 0 },
        to: { latitude: 1, longitude: 1 },
      })
    ).rejects.toThrow(/sem rota|NoRoute/)
  })

  it('formata URL com lon,lat (não lat,lon — atenção, OSRM inverte)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonOk({ code: 'Ok', routes: [{ distance: 1000, duration: 60 }] })
    )
    await osrm.route({
      from: { latitude: -23.5, longitude: -46.6 },
      to: { latitude: -23.6, longitude: -46.7 },
    })
    const calledUrl = String(mockFetch.mock.calls[0][0])
    expect(calledUrl).toContain('/route/v1/driving/-46.6,-23.5;-46.7,-23.6')
  })
})

// ─── geo.client envia X-API-Key (sem Accept) ────────────────────────────────

describe('geo.client transport', () => {
  it('envia header X-API-Key (mas NÃO Accept) — Nominatim recusa Accept:json', async () => {
    mockFetch.mockResolvedValueOnce(jsonOk([]))
    await nominatim.search({ q: 'teste' })
    const opts = mockFetch.mock.calls[0][1] as RequestInit | undefined
    const headers = opts?.headers as Record<string, string> | undefined
    expect(headers?.['X-API-Key']).toBe('test-key')
    expect(headers?.Accept).toBeUndefined()
    expect(headers?.['accept']).toBeUndefined()
  })

  it('propaga HTTP != 2xx como erro', async () => {
    mockFetch.mockResolvedValueOnce(jsonFail(500))
    await expect(nominatim.search({ q: 'x' })).rejects.toThrow(/respondeu 500/)
  })
})
