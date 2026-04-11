// TASK-007: Segurança Base — rate limiting

import express from 'express'
import request from 'supertest'

import { authenticatedRateLimiter, publicRateLimiter } from '../rateLimit.middleware'

describe('Rate limiters', () => {
  it('publicRateLimiter is a function (express middleware)', () => {
    expect(typeof publicRateLimiter).toBe('function')
  })

  it('authenticatedRateLimiter is a function (express middleware)', () => {
    expect(typeof authenticatedRateLimiter).toBe('function')
  })

  it('publicRateLimiter returns 429 after 100 requests within a minute', async () => {
    const app = express()
    app.get('/test', publicRateLimiter, (_req, res) => {
      res.status(200).json({ ok: true })
    })

    // First 100 requests pass through
    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/test')
      expect(res.status).toBe(200)
    }

    // 101st request is blocked
    const blocked = await request(app).get('/test')
    expect(blocked.status).toBe(429)
  }, 30000)

  it('publicRateLimiter and authenticatedRateLimiter are distinct middlewares', () => {
    expect(publicRateLimiter).not.toBe(authenticatedRateLimiter)
  })
})
