/**
 * Smoke test do cliente mTLS — bate em geo.menupanda.com.br/photon, /nominatim
 * e /osrm com o cert+key configurados no .env, confirmando que o handshake
 * acontece e os 3 serviços respondem.
 *
 * Rodar:  npx tsx scripts/geo-smoke.ts   (a partir de api/)
 */

import 'dotenv/config'

import { geoGet } from '../src/modules/menu/geo/geo.client'

async function main() {
  const photonUrl = process.env.GEO_AUTOCOMPLETE_URL
  const nominatimUrl = process.env.GEO_GEOCODING_URL
  const osrmUrl = process.env.GEO_ROUTING_URL
  if (!photonUrl || !nominatimUrl || !osrmUrl) {
    console.error('✗ Faltam ENVs GEO_AUTOCOMPLETE_URL/GEO_GEOCODING_URL/GEO_ROUTING_URL')
    process.exit(1)
  }

  let ok = true
  let failed = 0

  async function probe(label: string, url: string): Promise<void> {
    try {
      const t0 = Date.now()
      const data = (await geoGet(url)) as Record<string, unknown>
      const ms = Date.now() - t0
      const sample = JSON.stringify(data).slice(0, 90)
      console.log(`✓ ${label} (${ms}ms) — ${sample}...`)
    } catch (err) {
      ok = false
      failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`✗ ${label} FALHOU: ${msg}`)
    }
  }

  // Photon: autocomplete
  await probe(
    'Photon autocomplete',
    `${photonUrl}/api?q=avenida+paulista&limit=1&lang=default`
  )

  // Nominatim: status (deve responder "OK" — text/plain, mas geoGet lança em !ok,
  // não no Content-Type, então tentamos um search que retorna JSON).
  await probe(
    'Nominatim search',
    `${nominatimUrl}/search?q=avenida+paulista&format=json&limit=1&countrycodes=br`
  )

  // OSRM: rota Av Paulista → Pinheiros (SP)
  await probe(
    'OSRM route',
    `${osrmUrl}/route/v1/driving/-46.6566,-23.5614;-46.6919,-23.5670?overview=false`
  )

  if (!ok) {
    console.error(`\n${failed} smoke(s) falharam`)
    process.exit(1)
  }
  console.log('\nTodos os smokes passaram ✓')
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  process.exit(1)
})
