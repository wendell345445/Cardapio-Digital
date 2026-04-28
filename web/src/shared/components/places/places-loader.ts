import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

// Inicializacao unica das opcoes do Google Maps. setOptions() precisa rodar
// antes de qualquer importLibrary(), e a propria lib avisa se for chamado
// duas vezes — guardamos um flag pra ser idempotente.

let configured = false

function ensureConfigured(): void {
  if (configured) return
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_PLACES_API_KEY não configurada em web/.env')
  }
  setOptions({
    key: apiKey,
    v: 'weekly',
    language: 'pt-BR',
    region: 'BR',
  })
  configured = true
}

export async function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  ensureConfigured()
  return importLibrary('places')
}

export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  ensureConfigured()
  return importLibrary('maps')
}

export async function loadMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  ensureConfigured()
  return importLibrary('marker')
}
