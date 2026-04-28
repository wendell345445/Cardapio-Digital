-- Remove PENDING value from OrderStatus enum.
-- Postgres não suporta DROP VALUE em enums, então recriamos o tipo.
--
-- Pré-requisito: nenhum Order pode ter status='PENDING' (verificado antes da migration).
-- O valor PENDING do enum PaymentMethod NÃO é afetado (são tipos diferentes).

-- 1. Cria novo enum sem PENDING.
CREATE TYPE "OrderStatus_new" AS ENUM (
  'WAITING_PAYMENT_PROOF',
  'WAITING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED'
);

-- 2. Remove default antigo (referencia o enum antigo).
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

-- 3. Faz o cast via texto (Postgres não cast direto entre enums).
ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING ("status"::text::"OrderStatus_new");

-- 4. Substitui o tipo antigo pelo novo.
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

-- 5. Reaplica default agora apontando para o novo enum.
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'WAITING_CONFIRMATION';
