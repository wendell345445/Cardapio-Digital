// ─── TASK-123: Subdomain Routing — useStoreSlug ───────────────────────────────
// Lê o slug da loja a partir do hostname atual.
// Usado em todas as páginas públicas (menu, checkout, rastreamento, motoboy).

// `VITE_PUBLIC_ROOT_DOMAIN` é o domínio principal do produto (ex: `supercardapio.com.br`
// em prod, `cardapio.test` em dev). `cardapio.test` e `localhost` são mantidos sempre
// como aliases pra dev local não quebrar quando a env aponta pra outro domínio.
const PRIMARY_ROOT = (import.meta.env.VITE_PUBLIC_ROOT_DOMAIN as string | undefined) || 'supercardapio.com.br'
const ROOT_HOSTNAMES = Array.from(new Set([PRIMARY_ROOT, 'cardapio.test', 'localhost']))
const SUBDOMAIN_SUFFIXES = ROOT_HOSTNAMES
  .filter((d) => d !== 'localhost')
  .map((d) => `.${d}`)

/**
 * Retorna o slug da loja identificada pelo hostname atual:
 * - Domínio raiz (PUBLIC_ROOT_DOMAIN, cardapio.test, localhost) → null (sem loja)
 * - Subdomínio (*.{PUBLIC_ROOT_DOMAIN}, *.cardapio.test) → slug do primeiro segmento
 * - Qualquer outro hostname (domínio próprio) → '__custom_domain__' (backend resolve)
 */
export function useStoreSlug(): string | null {
  const hostname = window.location.hostname

  if (ROOT_HOSTNAMES.includes(hostname)) return null

  const isSubdomain = SUBDOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))

  if (isSubdomain) return hostname.split('.')[0]

  return '__custom_domain__'
}
