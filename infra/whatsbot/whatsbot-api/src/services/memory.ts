import pgvector from 'pgvector/pg'

import { env } from '../env.js'

import { pool } from './db.js'

export interface MemoryRow {
  role: 'customer' | 'bot'
  content: string
  created_at: Date
}

export interface CustomerProfile {
  summary: string | null
  message_count: number
}

export async function searchSimilar(
  storeId: string,
  customerPhone: string,
  embedding: number[],
  k: number
): Promise<MemoryRow[]> {
  const res = await pool.query<MemoryRow>(
    `SELECT role, content, created_at
       FROM chat_memory
      WHERE store_id = $1 AND customer_phone = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $3
      LIMIT $4`,
    [storeId, customerPhone, pgvector.toSql(embedding), k]
  )
  return res.rows
}

export async function getRecentMessages(
  storeId: string,
  customerPhone: string,
  limit: number
): Promise<MemoryRow[]> {
  const res = await pool.query<MemoryRow>(
    `SELECT role, content, created_at
       FROM chat_memory
      WHERE store_id = $1 AND customer_phone = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [storeId, customerPhone, limit]
  )
  return res.rows.reverse() // cronológico crescente
}

export async function insertMemory(
  storeId: string,
  customerPhone: string,
  role: 'customer' | 'bot',
  content: string,
  embedding: number[] | null
): Promise<void> {
  await pool.query(
    `INSERT INTO chat_memory (store_id, customer_phone, role, content, embedding)
     VALUES ($1, $2, $3, $4, $5)`,
    [storeId, customerPhone, role, content, embedding ? pgvector.toSql(embedding) : null]
  )
}

export async function getProfile(
  storeId: string,
  customerPhone: string
): Promise<CustomerProfile | null> {
  const res = await pool.query<CustomerProfile>(
    `SELECT summary, message_count FROM customer_profile
      WHERE store_id = $1 AND customer_phone = $2`,
    [storeId, customerPhone]
  )
  return res.rows[0] ?? null
}

export async function bumpProfileCounter(
  storeId: string,
  customerPhone: string
): Promise<number> {
  const res = await pool.query<{ message_count: number }>(
    `INSERT INTO customer_profile (store_id, customer_phone, message_count, updated_at)
     VALUES ($1, $2, 1, now())
     ON CONFLICT (store_id, customer_phone)
       DO UPDATE SET message_count = customer_profile.message_count + 1,
                     updated_at = now()
     RETURNING message_count`,
    [storeId, customerPhone]
  )
  return res.rows[0]?.message_count ?? 0
}

export async function setProfileSummary(
  storeId: string,
  customerPhone: string,
  summary: string
): Promise<void> {
  await pool.query(
    `UPDATE customer_profile
        SET summary = $3, updated_at = now()
      WHERE store_id = $1 AND customer_phone = $2`,
    [storeId, customerPhone, summary]
  )
}

export async function purgeOld(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM chat_memory
      WHERE created_at < now() - ($1 || ' days')::interval`,
    [env.MEMORY_RETENTION_DAYS]
  )
  return res.rowCount ?? 0
}
