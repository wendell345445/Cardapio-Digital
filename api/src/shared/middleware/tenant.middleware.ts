import { NextFunction, Request, Response } from 'express'

import { AppError } from './error.middleware'
import { prisma } from '../prisma/prisma'

// Lista de domínios raiz reconhecidos como "sem tenant" (owner/admin global) e cujos
// subdomínios identificam lojas via slug. `PUBLIC_ROOT_DOMAIN` é o domínio principal
// do produto (ex: `supercardapio.com.br` em prod, `cardapio.test` em dev). `cardapio.test`
// e `localhost` são mantidos sempre como aliases pra dev local não quebrar quando a env
// aponta pra outro domínio.
function getRootDomains(): string[] {
  const primary = process.env.PUBLIC_ROOT_DOMAIN || 'supercardapio.com.br'
  return Array.from(new Set([primary, 'cardapio.test', 'localhost']))
}

function getSubdomainSuffixes(): string[] {
  return getRootDomains()
    .filter((d) => d !== 'localhost')
    .map((d) => `.${d}`)
}

/**
 * Middleware para rotas autenticadas (admin, motoboy).
 * Lê storeId do JWT via req.user.storeId.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const storeId = req.user?.storeId
  if (!storeId) throw new AppError('Store context required', 403)
  req.tenant = { storeId }
  next()
}

/**
 * Middleware para rotas públicas (cardápio, pedidos, rastreamento).
 * Resolve a loja a partir do hostname da requisição:
 *   - *.{PUBLIC_ROOT_DOMAIN} / *.cardapio.test → busca por slug
 *   - qualquer outro hostname → busca por customDomain
 *   - domínio raiz → 404 (sem loja neste contexto)
 */
export async function publicTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hostname = req.hostname
    const rootDomains = getRootDomains()
    const subdomainSuffixes = getSubdomainSuffixes()

    if (rootDomains.includes(hostname)) {
      throw new AppError('Loja não encontrada', 404)
    }

    const isSubdomain = subdomainSuffixes.some((suffix) => hostname.endsWith(suffix))

    let store: { id: string; slug: string; name: string } | null = null

    if (isSubdomain) {
      const slug = hostname.split('.')[0]
      const found = await prisma.store.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true, customDomain: true },
      })
      // Loja com domínio próprio não é acessível via subdomínio
      if (found?.customDomain) throw new AppError('Loja não encontrada', 404)
      store = found
    } else {
      store = await prisma.store.findUnique({
        where: { customDomain: hostname },
        select: { id: true, slug: true, name: true, customDomain: true },
      })
    }

    if (!store) throw new AppError('Loja não encontrada', 404)

    req.store = store
    next()
  } catch (err) {
    next(err)
  }
}
