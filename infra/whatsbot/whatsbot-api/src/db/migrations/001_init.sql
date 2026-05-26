-- ─── Whatsbot AI — schema inicial ────────────────────────────────────────
-- RAG por cliente×loja: cada msg trocada vira linha em chat_memory com
-- embedding. customer_profile resume preferências (atualizado a cada N msgs).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chat_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL,
  customer_phone  TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('customer', 'bot')),
  content         TEXT NOT NULL,
  embedding       VECTOR(768),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_memory_store_phone_created_idx
  ON chat_memory (store_id, customer_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_memory_embedding_idx
  ON chat_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS customer_profile (
  store_id        UUID NOT NULL,
  customer_phone  TEXT NOT NULL,
  summary         TEXT,
  preferences     JSONB,
  message_count   INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, customer_phone)
);
