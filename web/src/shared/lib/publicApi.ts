import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios'

// Em prod, frontend mora em {slug}.menupanda.com.br e a API em api.menupanda.com.br.
// A requisição cross-origin perde o Host do subdomínio, então o middleware público
// não consegue derivar o slug. Este helper injeta X-Tenant-Slug em toda chamada.
const PRIMARY_ROOT =
  (import.meta.env.VITE_PUBLIC_ROOT_DOMAIN as string | undefined) || 'menupanda.com.br'
const ROOT_HOSTNAMES = Array.from(new Set([PRIMARY_ROOT, 'cardapio.test', 'localhost']))
const SUBDOMAIN_SUFFIXES = ROOT_HOSTNAMES.filter((d) => d !== 'localhost').map((d) => `.${d}`)

function currentTenantSlug(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname
  if (ROOT_HOSTNAMES.includes(hostname)) return null
  const isSubdomain = SUBDOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  if (isSubdomain) return hostname.split('.')[0]
  return null // custom domain — backend resolve pelo Host
}

export function createPublicApi(config: CreateAxiosDefaults = {}): AxiosInstance {
  const baseURL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1'
  const instance = axios.create({ baseURL, ...config })
  instance.interceptors.request.use((cfg) => {
    const slug = currentTenantSlug()
    if (slug) cfg.headers.set('X-Tenant-Slug', slug)
    return cfg
  })
  return instance
}
