// ─── REFERÊNCIA: cliente mTLS pra api Railway chamar o geo ────────────────
// NÃO é importado por nada ainda — é o molde de como o módulo geo/ da api
// (api/src/modules/menu/geo/) deve falar com geo.menupanda.com.br.
//
// fetch do Node 20 usa undici por baixo. Pra mTLS, passamos um undici.Agent
// com o cert+chave do cliente no `dispatcher`. O cert é o mesmo gerado por
// gen-mtls-certs.sh (client.crt/client.key), entregue via env (base64).
//
// ENV esperadas na api Railway:
//   GEO_GEOCODING_URL     = https://geo.menupanda.com.br/nominatim
//   GEO_AUTOCOMPLETE_URL  = https://geo.menupanda.com.br/photon
//   GEO_ROUTING_URL       = https://geo.menupanda.com.br/osrm
//   GEO_API_KEY           = <mesma chave do .env da VM>
//   GEO_CLIENT_CERT_B64   = base64 do client.crt
//   GEO_CLIENT_KEY_B64    = base64 do client.key
//   GEO_CA_CERT_B64       = base64 do ca.crt   (opcional: pin do servidor)

import { Agent } from 'undici'

function fromB64(envName: string): string {
  const v = process.env[envName]
  if (!v) throw new Error(`${envName} ausente — mTLS não configurado`)
  return Buffer.from(v, 'base64').toString('utf8')
}

// Agent reutilizável (criar UMA vez no boot, não por request).
let agent: Agent | null = null

function geoAgent(): Agent {
  if (agent) return agent
  agent = new Agent({
    connect: {
      cert: fromB64('GEO_CLIENT_CERT_B64'),
      key: fromB64('GEO_CLIENT_KEY_B64'),
      // Pin opcional do servidor: se setar GEO_CA_CERT_B64, validamos o cert
      // do servidor contra ela. Como o servidor usa Let's Encrypt, normalmente
      // NÃO precisa — o trust store do sistema já valida. Deixe comentado a
      // menos que queira pinning estrito.
      // ca: fromB64('GEO_CA_CERT_B64'),
    },
  })
  return agent
}

/** GET no geo com mTLS + API key. Lança em status != 2xx. */
export async function geoGet(
  url: string,
  signal?: AbortSignal
): Promise<Response> {
  const res = await fetch(url, {
    signal,
    headers: { 'X-API-Key': process.env.GEO_API_KEY ?? '' },
    // @ts-expect-error — `dispatcher` é extensão undici no fetch do Node
    dispatcher: geoAgent(),
  })
  if (!res.ok) {
    throw new Error(`geo ${url} respondeu ${res.status}`)
  }
  return res
}

// Exemplo de uso (autocomplete):
//   const u = new URL(`${process.env.GEO_AUTOCOMPLETE_URL}/api`)
//   u.searchParams.set('q', query)
//   if (storeLat) u.searchParams.set('lat', String(storeLat))
//   const res = await geoGet(u.toString(), ctrl.signal)
//   const data = await res.json()
