import { randomUUID } from 'crypto'

import { compare, hash } from 'bcrypt'
import { sign, verify } from 'jsonwebtoken'
import type { StringValue } from 'ms'

import { logger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { getRedis } from '../../shared/redis/redis'

const SALT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m' as const
const REFRESH_TOKEN_EXPIRY = '7d'
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

// Sessão única: blacklist expira um pouco além do maior access token em uso.
// Admin/Owner = 15min; cobrimos até 1h pra folga (ex: clock drift).
const REVOKED_SESSION_TTL_SECONDS = 60 * 60

export interface TokenPayload {
  userId: string
  role: string
  storeId?: string
  jti?: string
}

// Roles que têm sessão única (apenas 1 dispositivo ativo por vez).
// MOTOBOY pode logar em múltiplos celulares simultâneos — regra de negócio.
const SINGLE_SESSION_ROLES = new Set(['ADMIN', 'OWNER'])

function isSingleSessionRole(role: string): boolean {
  return SINGLE_SESSION_ROLES.has(role)
}

/**
 * Revoga a sessão anterior do usuário (se houver) e registra a nova como ativa.
 * Qualquer request subsequente com o jti antigo será rejeitada no middleware.
 * Só aplica para roles em SINGLE_SESSION_ROLES — motoboy multi-dispositivo passa direto.
 */
async function rotateActiveSession(userId: string, newJti: string, role: string): Promise<void> {
  if (!isSingleSessionRole(role)) return
  try {
    const redis = getRedis()
    const activeKey = `session:active:${userId}`
    const previousJti = await redis.get(activeKey)
    if (previousJti && previousJti !== newJti) {
      await redis.setex(`session:revoked:${previousJti}`, REVOKED_SESSION_TTL_SECONDS, '1')
    }
    await redis.setex(activeKey, REVOKED_SESSION_TTL_SECONDS, newJti)
  } catch (err) {
    // Redis fora: não bloquear login. Logar e seguir.
    logger.warn({ err, userId }, '[Auth] rotateActiveSession falhou (Redis indisponível?)')
  }
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string
    email: string | null
    name: string | null
    role: string
    storeId: string | null
  }
}

function generateTokens(
  payload: TokenPayload,
  accessExpiry: StringValue = ACCESS_TOKEN_EXPIRY
): AuthTokens & { jti: string } {
  const jti = payload.jti ?? randomUUID()
  const accessPayload = { ...payload, jti }
  const accessToken = sign(accessPayload, process.env.JWT_SECRET!, { expiresIn: accessExpiry })
  const refreshToken = sign({ userId: payload.userId, jti }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  })
  return { accessToken, refreshToken, jti }
}

export async function validateCredentials(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
  })

  if (!user || !user.passwordHash) {
    throw new AppError('Credenciais inválidas', 401)
  }

  const valid = await compare(password, user.passwordHash)
  if (!valid) {
    throw new AppError('Credenciais inválidas', 401)
  }

  return user
}

export type LoginScope = 'admin' | 'motoboy'

export async function loginWithPassword(
  email: string,
  password: string,
  scope: LoginScope = 'admin'
): Promise<AuthResult> {
  const user = await validateCredentials(email, password)

  // Scope enforcement: motoboy login só aceita MOTOBOY; admin login rejeita MOTOBOY.
  // OWNER e ADMIN compartilham o scope 'admin' (ambos usam /login).
  if (scope === 'motoboy' && user.role !== 'MOTOBOY') {
    throw new AppError('Este login é exclusivo para entregadores', 403, 'WRONG_SCOPE')
  }
  if (scope === 'admin' && user.role === 'MOTOBOY') {
    throw new AppError('Este login é exclusivo para administradores', 403, 'WRONG_SCOPE')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    ...(user.storeId ? { storeId: user.storeId } : {}),
  }

  // Motoboy tokens have 8h access (no mid-shift refresh)
  const accessExpiry = user.role === 'MOTOBOY' ? '8h' : ACCESS_TOKEN_EXPIRY
  const tokens = generateTokens(payload, accessExpiry)

  // Single-session: revoga sessão anterior (se ADMIN/OWNER) e marca essa como ativa
  await rotateActiveSession(user.id, tokens.jti, user.role)

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      storeId: user.storeId ?? null,
    },
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  let payload: { userId: string; jti?: string }
  try {
    payload = verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string; jti?: string }
  } catch {
    throw new AppError('Refresh token inválido ou expirado', 401)
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  })

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token inválido ou expirado', 401)
  }

  if (!storedToken.user.isActive) {
    throw new AppError('Usuário inativo', 401)
  }

  // Single-session: se o jti do refresh não for mais o ativo, a sessão foi revogada
  // (outro login derrubou esse dispositivo). Bloqueia o refresh.
  if (payload.jti && isSingleSessionRole(storedToken.user.role)) {
    try {
      const activeJti = await getRedis().get(`session:active:${storedToken.user.id}`)
      if (activeJti && activeJti !== payload.jti) {
        throw new AppError('Sessão encerrada em outro dispositivo', 401, 'SESSION_REVOKED')
      }
    } catch (err) {
      if (err instanceof AppError) throw err
      logger.warn({ err, userId: storedToken.user.id }, '[Auth] refresh check de sessão ativa falhou')
    }
  }

  const accessPayload: TokenPayload & { jti: string } = {
    userId: payload.userId,
    role: storedToken.user.role,
    ...(storedToken.user.storeId ? { storeId: storedToken.user.storeId } : {}),
    jti: payload.jti ?? randomUUID(),
  }

  const accessToken = sign(accessPayload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })

  return { accessToken }
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
}

export async function reauth(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user || !user.passwordHash) {
    throw new AppError('Credenciais inválidas', 401)
  }

  const valid = await compare(password, user.passwordHash)
  if (!valid) {
    throw new AppError('Senha incorreta', 401)
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS)
}

export type OAuthResult = AuthResult | { notFound: 'motoboy' }

export async function findOrCreateOAuthUser(params: {
  email: string
  name?: string
  provider: 'google' | 'facebook'
  providerId: string
  scope?: 'motoboy' | 'admin'
}): Promise<OAuthResult> {
  const { email, name, provider, providerId, scope } = params

  const providerField = provider === 'google' ? 'googleId' : 'facebookId'

  // Mesmo email pode ter múltiplos Users (admin vs motoboy cadastrado pela loja).
  // Desambigua pelo scope: motoboy busca primeiro um User MOTOBOY; admin exclui motoboys.
  const expectedRole = scope === 'motoboy' ? 'MOTOBOY' : null
  let user = expectedRole
    ? await prisma.user.findFirst({ where: { email, role: expectedRole } })
    : await prisma.user.findFirst({ where: { email, NOT: { role: 'MOTOBOY' } } })

  if (user) {
    // Link provider ID if not already linked
    if (!user[providerField]) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [providerField]: providerId, lastLoginAt: new Date() },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
    }
  } else if (scope === 'motoboy') {
    // Login Google no /motoboy exige User MOTOBOY já cadastrado pela loja.
    // Nunca criar um motoboy via OAuth — precisa do vínculo com storeId.
    return { notFound: 'motoboy' } as const
  } else {
    // Scope admin sem user existente → self-register implícito como ADMIN sem loja.
    // Mantido pra permitir onboarding por login Google (owner cria conta e depois vincula loja).
    user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'ADMIN',
        [providerField]: providerId,
        lastLoginAt: new Date(),
      },
    })
  }

  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    ...(user.storeId ? { storeId: user.storeId } : {}),
  }

  const tokens = generateTokens(payload)
  await rotateActiveSession(user.id, tokens.jti, user.role)

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
      storeId: user.storeId ?? null,
    },
  }
}

export function generateClientToken(orderId: string): string {
  return sign({ orderId, type: 'client' }, process.env.JWT_SECRET!, { expiresIn: '24h' })
}

export function verifyClientToken(token: string): { orderId: string } {
  try {
    const payload = verify(token, process.env.JWT_SECRET!) as { orderId: string; type: string }
    if (payload.type !== 'client') throw new AppError('Token inválido', 401)
    return { orderId: payload.orderId }
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('Token inválido ou expirado', 401)
  }
}

export function generateMotoboyTokens(userId: string, role: string, storeId: string): AuthTokens {
  const payload: TokenPayload = { userId, role, storeId }
  const tokens = generateTokens(payload, '8h')
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
}

/**
 * Emite tokens JWT + persiste o refresh token. Usado pelo auto-cadastro (v2.5+)
 * para logar o usuário automaticamente após registerStore().
 */
export async function generateAuthTokensForNewUser(payload: TokenPayload): Promise<AuthTokens> {
  const tokens = generateTokens(payload)
  await rotateActiveSession(payload.userId, tokens.jti, payload.role)

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: payload.userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  })

  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
}
