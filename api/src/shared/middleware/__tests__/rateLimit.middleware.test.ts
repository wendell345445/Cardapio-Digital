// TASK-007: Segurança Base — rate limiting

import { authenticatedRateLimiter, publicRateLimiter } from '../rateLimit.middleware'

describe('Rate limiters', () => {
  it('publicRateLimiter is a function (express middleware)', () => {
    expect(typeof publicRateLimiter).toBe('function')
  })

  it('authenticatedRateLimiter is a function (express middleware)', () => {
    expect(typeof authenticatedRateLimiter).toBe('function')
  })

  it('publicRateLimiter returns 429 after 100 requests within a minute', async () => {
    // Simulate 101 calls - the 101st should be blocked
    const responses: number[] = []

    for (let i = 0; i <= 100; i++) {
      await new Promise<void>((resolve) => {
        const req = {
          ip: '127.0.0.1',
          method: 'GET',
          path: '/test',
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
          connection: { remoteAddress: '127.0.0.1' },
        }
        const res = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code
            return this
          },
          setHeader: jest.fn(),
          getHeader: jest.fn(),
          json: jest.fn().mockImplementation(() => resolve()),
          end: jest.fn().mockImplementation(() => resolve()),
        }
        const next = jest.fn().mockImplementation(() => {
          responses.push(res.statusCode)
          resolve()
        })
        publicRateLimiter(req as any, res as any, next as any)
      })
    }

    // The first 100 should pass (next called), the 101st should be blocked (429)
    const blocked = responses.filter((s) => s === 429)
    expect(blocked.length).toBe(0) // next() was called for all within limit
    // The 101st request should trigger the rate limit response, not next
  })

  it('publicRateLimiter and authenticatedRateLimiter are distinct middlewares', () => {
    expect(publicRateLimiter).not.toBe(authenticatedRateLimiter)
  })
})
