-- 1. Adiciona coluna nullable
ALTER TABLE "Table" ADD COLUMN "accessToken" TEXT;

-- 2. Backfill: gera token aleatório base64url-ish pra cada Table sem accessToken.
-- Usa md5(uuid + clock_timestamp) trimado pra 16 chars — não-adivinhável o suficiente
-- pro escopo (16 hex chars = 64 bits). Sem dependência de pgcrypto.
UPDATE "Table"
SET "accessToken" = substr(md5(random()::text || clock_timestamp()::text || id), 1, 16)
WHERE "accessToken" IS NULL;

-- 3. NOT NULL + unique
ALTER TABLE "Table" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Table_accessToken_key" ON "Table"("accessToken");
