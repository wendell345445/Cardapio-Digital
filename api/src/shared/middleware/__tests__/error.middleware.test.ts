// TASK-007: Segurança Base — error handler

import { NextFunction, Request, Response } from 'express'
import { ZodError, z } from 'zod'

import { AppError, errorHandler } from '../error.middleware'

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const req = {} as Request
const next = jest.fn() as unknown as NextFunction

// ─── AppError ─────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('creates error with message and default status 400', () => {
    const err = new AppError('Bad request')
    expect(err.message).toBe('Bad request')
    expect(err.status).toBe(400)
    expect(err.name).toBe('AppError')
  })

  it('accepts a custom status code', () => {
    const err = new AppError('Not found', 404)
    expect(err.status).toBe(404)
  })

  it('is an instance of Error', () => {
    expect(new AppError('x')).toBeInstanceOf(Error)
  })
})

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('responds 400 with validation details for ZodError', () => {
    const res = makeRes()
    let zodErr: ZodError
    try {
      z.object({ name: z.string() }).parse({ name: 123 })
    } catch (e) {
      zodErr = e as ZodError
    }
    errorHandler(zodErr!, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Validation error', details: expect.any(Array) })
    )
  })

  it('responds with AppError status and message', () => {
    const res = makeRes()
    const err = new AppError('Not found', 404)
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not found' })
  })

  it('responds 500 for generic errors', () => {
    const res = makeRes()
    const err = new Error('Something broke')
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Something broke' })
  })

  it('responds 500 with fallback message when error has no message', () => {
    const res = makeRes()
    const err = new Error()
    err.message = ''
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Internal server error' })
    )
  })
})
