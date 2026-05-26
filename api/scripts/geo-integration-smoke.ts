/**
 * Smoke de integração: testa geocodeAddress / reverseGeocode com a feature
 * flag GEO_USE_OSM ligada. Confirma que o caminho OSM funciona ponta-a-ponta
 * pelo wrapper que o produto vai usar.
 */

import 'dotenv/config'

// Liga a flag explicitamente (não muda .env)
process.env.GEO_USE_OSM = 'true'
process.env.GEO_USE_OSRM_ROUTING = 'true'

// Skip cache (Redis pode não estar rodando)
import { geocodeAddress, reverseGeocode } from '../src/modules/menu/geocoding.service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).fetch = undefined // não queremos chamadas Google

async function main() {
  console.log('▶ GEO_USE_OSM=true — testando wrapper geocodeAddress / reverseGeocode')
  console.log('')

  try {
    const r1 = await geocodeAddress({
      street: 'Avenida Paulista',
      number: '1578',
      city: 'São Paulo',
      state: 'SP',
    })
    console.log('✓ geocodeAddress (Paulista 1578):')
    console.log(`  → [${r1.latitude}, ${r1.longitude}]`)
    console.log(`  → ${r1.displayName?.slice(0, 100)}`)
    console.log('')
  } catch (err) {
    console.error('✗ geocodeAddress falhou:', err instanceof Error ? err.message : err)
  }

  try {
    const r2 = await reverseGeocode(-23.5614, -46.6566)
    console.log('✓ reverseGeocode (Paulista pin):')
    console.log(`  → ${r2.displayName?.slice(0, 100)}`)
  } catch (err) {
    console.error('✗ reverseGeocode falhou:', err instanceof Error ? err.message : err)
  }
}

main().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
