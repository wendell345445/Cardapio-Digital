import { mkdirSync } from 'fs'
import path from 'path'

import pino, { type Logger } from 'pino'

// ─── Paths ────────────────────────────────────────────────────────
// Logs vão em `api/logs/` (ignorado no .gitignore via `*.log`).
// Em prod, `process.cwd()` é o root do api quando rodado via `npm start`.
const LOGS_DIR = path.resolve(process.cwd(), 'logs')
try {
  mkdirSync(LOGS_DIR, { recursive: true })
} catch {
  // pasta já existe — ignorar
}

const isDev = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

// ─── Loggers ──────────────────────────────────────────────────────

/**
 * Logger geral da aplicação. Emite JSON estruturado para stdout.
 * Em dev usa pino-pretty pra output colorido legível.
 * Em test, silencia (level 'silent') para não poluir output dos testes.
 */
export const logger: Logger = pino({
  level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
  ...(isDev && !isTest
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
})

/**
 * Logger dedicado para fluxos Stripe (webhooks, subscription lifecycle, trial suspension).
 * Escreve JSON estruturado em `logs/stripe.log` com rotação (45 dias, mantém 3 arquivos).
 * Cada linha é um objeto JSON self-contained para fácil parse/grep.
 *
 * Em test, retorna um logger `silent` pra não tentar escrever arquivo.
 */
export const stripeLogger: Logger = isTest
  ? pino({ level: 'silent' })
  : pino({
      level: process.env.LOG_LEVEL_STRIPE || 'debug',
      transport: {
        targets: [
          {
            target: 'pino-roll',
            options: {
              file: path.resolve(LOGS_DIR, 'stripe.log'),
              frequency: 3_888_000_000, // 45 dias em ms
              limit: { count: 3 },
              mkdir: true,
            },
            level: 'debug',
          },
          ...(isDev
            ? [
                {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
                  level: 'debug',
                },
              ]
            : [
                {
                  target: 'pino/file',
                  options: { destination: 1 }, // stdout
                  level: 'debug',
                },
              ]),
        ],
      },
    })
