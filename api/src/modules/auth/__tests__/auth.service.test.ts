import { hash } from 'bcrypt'
import { verify } from 'jsonwebtoken'

// Mock prisma
jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  findOrCreateOAuthUser,
  generateClientToken,
  generateMotoboyTokens,
  loginWithPassword,
  logout,
  reauth,
  refreshAccessToken,
  verifyClientToken,
} from '../auth.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN' as const,
  storeId: 'store-1',
  isActive: true,
  passwordHash: '',
  whatsapp: null,
  googleId: null,
  facebookId: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeAll(async () => {
  mockUser.passwordHash = await hash('correct-password', 12)
})

beforeEach(() => jest.clearAllMocks())

describe('validateCredentials / loginWithPassword', () => {
  it('returns tokens and user on valid credentials', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await loginWithPassword('test@example.com', 'correct-password')

    if ('notFound' in result) throw new Error('expected success, got notFound')
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.user.id).toBe('user-1')
    expect(result.user.role).toBe('ADMIN')
  })

  it('throws 401 on wrong password', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser)

    await expect(loginWithPassword('test@example.com', 'wrong')).rejects.toMatchObject({
      status: 401,
    })
  })

  it('throws 401 when user not found', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(loginWithPassword('no@user.com', 'any')).rejects.toMatchObject({
      status: 401,
    })
  })

  it('issues 8h access token for MOTOBOY role', async () => {
    const motoboyUser = { ...mockUser, role: 'MOTOBOY' as const }
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(motoboyUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(motoboyUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await loginWithPassword('motoboy@example.com', 'correct-password', 'motoboy')

    const decoded = verify(result.accessToken, 'test-secret') as { exp: number; iat: number }
    const durationSeconds = decoded.exp - decoded.iat
    // 8h = 28800s (allow some tolerance)
    expect(durationSeconds).toBeGreaterThanOrEqual(28799)
    expect(durationSeconds).toBeLessThanOrEqual(28801)
  })

  it('rejects MOTOBOY login via admin scope with 403', async () => {
    const motoboyUser = { ...mockUser, role: 'MOTOBOY' as const }
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(motoboyUser)

    await expect(
      loginWithPassword('motoboy@example.com', 'correct-password', 'admin')
    ).rejects.toMatchObject({ status: 403, code: 'WRONG_SCOPE' })
  })

  it('rejects ADMIN login via motoboy scope with 403', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser)

    await expect(
      loginWithPassword('test@example.com', 'correct-password', 'motoboy')
    ).rejects.toMatchObject({ status: 403, code: 'WRONG_SCOPE' })
  })

  it('allows OWNER login via admin scope', async () => {
    const ownerUser = { ...mockUser, role: 'OWNER' as const }
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(ownerUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(ownerUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await loginWithPassword('owner@example.com', 'correct-password', 'admin')
    expect(result.user.role).toBe('OWNER')
  })
})

describe('generateTokens (access expires 15min for non-motoboy)', () => {
  it('access token expires in 15min for ADMIN', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await loginWithPassword('test@example.com', 'correct-password')

    const decoded = verify(result.accessToken, 'test-secret') as { exp: number; iat: number }
    const durationSeconds = decoded.exp - decoded.iat
    // 15min = 900s
    expect(durationSeconds).toBeGreaterThanOrEqual(899)
    expect(durationSeconds).toBeLessThanOrEqual(901)
  })
})

describe('refreshAccessToken', () => {
  it('returns new access token for valid refresh token', async () => {
    const { sign } = require('jsonwebtoken')
    const refreshToken = sign({ userId: 'user-1' }, 'test-refresh-secret', { expiresIn: '7d' })

    ;(mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: { ...mockUser },
    })

    const result = await refreshAccessToken(refreshToken)
    if ('notFound' in result) throw new Error('expected success, got notFound')
    expect(result.accessToken).toBeDefined()
  })

  it('throws 401 for expired/invalid refresh token', async () => {
    await expect(refreshAccessToken('invalid-token')).rejects.toMatchObject({ status: 401 })
  })
})

describe('logout', () => {
  it('deletes refresh token from database', async () => {
    ;(mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    await logout('some-refresh-token')

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'some-refresh-token' },
    })
  })
})

describe('reauth', () => {
  it('resolves on correct password', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

    await expect(reauth('user-1', 'correct-password')).resolves.toBeUndefined()
  })

  it('throws 401 on wrong password', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

    await expect(reauth('user-1', 'wrong')).rejects.toMatchObject({ status: 401 })
  })
})

describe('generateClientToken / verifyClientToken', () => {
  it('round-trips correctly', () => {
    const token = generateClientToken('order-123')
    const result = verifyClientToken(token)
    expect(result.orderId).toBe('order-123')
  })

  it('throws 401 on invalid token', () => {
    expect(() => verifyClientToken('bad-token')).toThrow()
  })

  it('throws 401 for a token without type=client', () => {
    const { sign } = require('jsonwebtoken')
    const token = sign({ orderId: 'order-x', type: 'other' }, 'test-secret', { expiresIn: '24h' })
    expect(() => verifyClientToken(token)).toThrow()
  })
})

describe('refreshAccessToken — edge cases', () => {
  it('throws 401 when refresh token is expired in database', async () => {
    const { sign } = require('jsonwebtoken')
    const refreshToken = sign({ userId: 'user-1' }, 'test-refresh-secret', { expiresIn: '7d' })

    ;(mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      token: refreshToken,
      expiresAt: new Date(Date.now() - 1000), // already expired
      user: { ...mockUser },
    })

    await expect(refreshAccessToken(refreshToken)).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when user is inactive', async () => {
    const { sign } = require('jsonwebtoken')
    const refreshToken = sign({ userId: 'user-1' }, 'test-refresh-secret', { expiresIn: '7d' })

    ;(mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user: { ...mockUser, isActive: false },
    })

    await expect(refreshAccessToken(refreshToken)).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when token not found in database', async () => {
    const { sign } = require('jsonwebtoken')
    const refreshToken = sign({ userId: 'user-1' }, 'test-refresh-secret', { expiresIn: '7d' })

    ;(mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(refreshAccessToken(refreshToken)).rejects.toMatchObject({ status: 401 })
  })
})

describe('findOrCreateOAuthUser', () => {

  it('creates a new user when email does not exist', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({
      ...mockUser,
      googleId: 'google-123',
      role: 'ADMIN',
    })
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await findOrCreateOAuthUser({
      email: 'new@example.com',
      name: 'New User',
      provider: 'google',
      providerId: 'google-123',
    })

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleId: 'google-123', role: 'ADMIN' }),
      })
    )
    if ('notFound' in result) throw new Error('expected success, got notFound')
    expect(result.accessToken).toBeDefined()
  })

  it('links googleId to existing user when not yet linked', async () => {
    const existingUser = { ...mockUser, googleId: null }
    const linkedUser = { ...mockUser, googleId: 'google-456' }
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(linkedUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    const result = await findOrCreateOAuthUser({
      email: 'test@example.com',
      name: 'Test User',
      provider: 'google',
      providerId: 'google-456',
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleId: 'google-456' }),
      })
    )
    if ('notFound' in result) throw new Error('expected success, got notFound')
    expect(result.accessToken).toBeDefined()
  })

  it('skips linking when googleId is already set', async () => {
    const existingUser = { ...mockUser, googleId: 'existing-google-id' }
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(existingUser)
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    await findOrCreateOAuthUser({
      email: 'test@example.com',
      name: 'Test User',
      provider: 'google',
      providerId: 'other-google-id',
    })

    // update called only to bump lastLoginAt, NOT with googleId
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      })
    )
    expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleId: 'other-google-id' }),
      })
    )
  })

  it('links facebookId for facebook provider', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue({
      ...mockUser,
      facebookId: 'fb-789',
      role: 'ADMIN',
    })
    ;(mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({})

    await findOrCreateOAuthUser({
      email: 'fb@example.com',
      name: 'FB User',
      provider: 'facebook',
      providerId: 'fb-789',
    })

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ facebookId: 'fb-789' }),
      })
    )
  })
})

describe('generateMotoboyTokens', () => {

  it('generates tokens with 8h access expiry', () => {
    const tokens = generateMotoboyTokens('user-moto', 'MOTOBOY', 'store-1')

    expect(tokens.accessToken).toBeDefined()
    expect(tokens.refreshToken).toBeDefined()

    const { verify } = require('jsonwebtoken')
    const decoded = verify(tokens.accessToken, 'test-secret') as {
      exp: number
      iat: number
      userId: string
      role: string
      storeId: string
    }
    const durationSeconds = decoded.exp - decoded.iat
    expect(durationSeconds).toBeGreaterThanOrEqual(28799)
    expect(durationSeconds).toBeLessThanOrEqual(28801)
    expect(decoded.userId).toBe('user-moto')
    expect(decoded.role).toBe('MOTOBOY')
    expect(decoded.storeId).toBe('store-1')
  })
})
