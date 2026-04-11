/**
 * Lista de slugs reservados pelo sistema multi-tenant.
 *
 * Contexto: cada loja vira um subdomínio `{slug}.{PUBLIC_ROOT_DOMAIN}`
 * (ver constitution.md §VIII — Domínios). Como o DNS usa uma regra
 * específica por subdomínio (`api`, `www`) junto com um wildcard
 * `*.{PUBLIC_ROOT_DOMAIN}`, um slug que colide com um subdomínio de
 * infraestrutura **roteia a loja pro serviço errado** (ex: `api` cai no
 * backend em vez do cardápio público).
 *
 * A lista cobre:
 *  - CNAMEs específicos já publicados no DNS (`api`, `www`)
 *  - Subdomínios de infra que provavelmente adicionaremos no futuro
 *    (`admin`, `app`, `dashboard`, `cdn`, `static`, `assets`, `mail`,
 *    `ftp`, `webhook(s)`)
 *  - Páginas de marketing/produto que já moram no apex e colidem
 *    visualmente (`blog`, `docs`, `help`, `status`, `support`, `suporte`)
 *  - Rotas conhecidas do próprio app (`cadastro`, `login`, `checkout`,
 *    `painel`)
 *  - Reservas técnicas (`_acme-challenge` pro Let's Encrypt, `vercel`,
 *    `railway`)
 *
 * Aplicação:
 *  - `owner.schema.ts` rejeita via Zod `.refine()` (422 com mensagem clara)
 *  - `register.service.ts#generateUniqueSlug` pula pro sufixo `-2` quando
 *    o nome da loja normaliza pra um slug reservado
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // CNAMEs já publicados no DNS
  'api',
  'www',
  // Infra futura
  'admin',
  'app',
  'dashboard',
  'cdn',
  'static',
  'assets',
  'mail',
  'ftp',
  'webhook',
  'webhooks',
  // Marketing / produto
  'blog',
  'docs',
  'help',
  'status',
  'support',
  'suporte',
  // Rotas do app
  'cadastro',
  'login',
  'checkout',
  'painel',
  // Reservas técnicas
  '_acme-challenge',
  'vercel',
  'railway',
])

/**
 * Retorna `true` se o slug colide com um subdomínio reservado pelo sistema.
 * Comparação é case-insensitive — o schema Zod já força lowercase, mas
 * aceitar maiúsculas aqui evita surpresas em chamadores futuros.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}
