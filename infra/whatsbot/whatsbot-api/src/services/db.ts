import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import pgvector from 'pgvector/pg'

import { env } from '../env.js'

const { Pool, Client } = pg

// Pool principal — só é usado APÓS runMigrations() rodar (no boot). O listener
// `connect` registra o tipo vector pra cada nova conexão; ele precisa que a
// extensão vector já exista, então rodamos migrations primeiro num Client
// dedicado, fora do pool.
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 })

pool.on('connect', (client) => {
  // Registra de forma síncrona. Erros aqui propagam pro próximo query do client.
  pgvector.registerType(client).catch(() => {
    // Se cair aqui, próxima query do client vai falhar — propaga naturalmente.
  })
})

export async function runMigrations(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const migrationsDir = join(here, '..', 'db', 'migrations')
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  // Client dedicado pra migrations — evita o listener `connect` do pool, que
  // chama pgvector.registerType(). registerType faz SELECT 'vector'::regtype,
  // mas no PRIMEIRO boot a extensão ainda não existe → falha. Rodando as
  // migrations num client separado, contornamos o ciclo de boot.
  const client = new Client({ connectionString: env.DATABASE_URL })
  await client.connect()
  try {
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}
