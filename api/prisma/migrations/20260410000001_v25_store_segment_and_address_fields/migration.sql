-- v2.5 — Self-register: adiciona enum StoreSegment + 7 campos opcionais de endereço.
-- Todos os campos são nullable → migração não-destrutiva, lojas existentes ficam com NULL.

-- CreateEnum
CREATE TYPE "StoreSegment" AS ENUM ('RESTAURANT', 'PIZZERIA', 'BURGER', 'BAKERY', 'ACAI', 'JAPANESE', 'MARKET', 'OTHER');

-- AlterTable
ALTER TABLE "Store"
  ADD COLUMN "segment" "StoreSegment",
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "number" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT;
