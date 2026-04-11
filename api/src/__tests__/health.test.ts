// TASK-001: Monorepo e Configuração Base — health endpoint
// TASK-004: Redis — health check endpoint

import request from 'supertest'

// Prevent passport/prisma/socket from crashing in test env
jest.mock('../shared/prisma/prisma', () => ({
  prisma: {},
}))

jest.mock('../shared/socket/socket', () => ({
  initSocket: jest.fn(),
  getIo: jest.fn(),
  emit: {},
}))

jest.mock('../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

import { app } from '../app'

describe('GET /health', () => {
  it('responds 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
  })

  it('includes a timestamp in ISO format', async () => {
    const res = await request(app).get('/health')
    expect(res.body.timestamp).toBeDefined()
    expect(() => new Date(res.body.timestamp)).not.toThrow()
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp)
  })

  it('sets security headers via Helmet', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBeDefined()
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})

describe('Unknown routes', () => {
  it('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/this-route-does-not-exist')
    expect(res.status).toBe(404)
  })
})
