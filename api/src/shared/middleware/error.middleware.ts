import { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors,
    })
    return
  }

  const status = (err as { status?: number }).status || 500
  const message = err.message || 'Internal server error'
  const code = (err as { code?: string }).code

  if (status >= 500) {
    console.error('Server error:', err)
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(code ? { code } : {}),
  })
}

export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
