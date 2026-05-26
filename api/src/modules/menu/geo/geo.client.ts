import { readFileSync } from 'fs'
import { resolve } from 'path'

import { Agent, fetch as undiciFetch } from 'undici'

import { AppError } from '../../../shared/middleware/error.middleware'

// Cliente HTTP mTLS pra stack OSM self-hosted (geo.menupanda.com.br).
// O Caddy do servidor exige cert de cliente assinado pela nossa CA — sem ele
// a conexão é recusada no handshake TLS. Quem apresenta é a api (server-side);
// o browser NUNCA bate direto no geo.menupanda.com.br em produção.
//
// Cert+key vêm de DUAS fontes (a primeira que existir ganha):
//   1. GEO_CLIENT_CERT_PATH / GEO_CLIENT_KEY_PATH — arquivos (dev local).
//   2. GEO_CLIENT_CERT_B64  / GEO_CLIENT_KEY_B64  — base64 (Railway prod).

let cachedAgent: Agent | null = null

function loadFromPath(path: string): string {
  // Resolve relativo a process.cwd() (que é `api/` em dev e prod via `cd api &&
  // node`). Path absoluto também funciona.
  const abs = resolve(process.cwd(), path)
  return readFileSync(abs, 'utf8')
}

function loadFromBase64(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8')
}

function loadCertAndKey(): { cert: string; key: string } {
  const certPath = process.env.GEO_CLIENT_CERT_PATH
  const keyPath = process.env.GEO_CLIENT_KEY_PATH
  if (certPath && keyPath) {
    try {
      return { cert: loadFromPath(certPath), key: loadFromPath(keyPath) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new AppError(`mTLS: falha ao ler cert+key de path (${msg})`, 503)
    }
  }
  const certB64 = process.env.GEO_CLIENT_CERT_B64
  const keyB64 = process.env.GEO_CLIENT_KEY_B64
  if (certB64 && keyB64) {
    return { cert: loadFromBase64(certB64), key: loadFromBase64(keyB64) }
  }
  throw new AppError(
    'mTLS: configure GEO_CLIENT_CERT_PATH/KEY_PATH (dev) ou GEO_CLIENT_CERT_B64/KEY_B64 (prod)',
    503
  )
}

function getAgent(): Agent {
  if (cachedAgent) return cachedAgent
  const { cert, key } = loadCertAndKey()
  cachedAgent = new Agent({ connect: { cert, key } })
  return cachedAgent
}

function apiKey(): string {
  const k = process.env.GEO_API_KEY
  if (!k || !k.trim()) {
    throw new AppError('GEO_API_KEY não configurada', 503)
  }
  return k
}

/** GET no geo (mTLS + X-API-Key). Lança AppError em status != 2xx. */
export async function geoGet(url: string, signal?: AbortSignal): Promise<unknown> {
  let res
  try {
    // NÃO enviar `Accept: application/json` — o Nominatim recusa esse header
    // com 406 (ele negocia pelo `format=json` na query). Photon e OSRM já
    // retornam JSON por padrão, então omitir é seguro pros 3.
    res = await undiciFetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey() },
      dispatcher: getAgent(),
      signal,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AppError(`Serviço geo indisponível: ${msg}`, 503)
  }
  if (!res.ok) {
    throw new AppError(`Geo respondeu ${res.status} em ${url}`, res.status === 403 ? 503 : 502)
  }
  return res.json()
}

/** Reseta o Agent cacheado (testes). Não usar em produção. */
export function __resetGeoAgentForTests(): void {
  cachedAgent = null
}
