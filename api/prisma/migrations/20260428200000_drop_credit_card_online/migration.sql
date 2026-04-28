-- Drop "Cartão de Crédito (online)" payment option.
-- Removes Store.allowCreditCard column and CREDIT_CARD value from PaymentMethod enum.
-- Pre-existing orders/cashflow items with paymentMethod='CREDIT_CARD' (online card,
-- never integrated) are migrated to CREDIT_ON_DELIVERY (closest existing option).

UPDATE "Order" SET "paymentMethod" = 'CREDIT_ON_DELIVERY' WHERE "paymentMethod" = 'CREDIT_CARD';
UPDATE "CashFlowItem" SET "paymentMethod" = 'CREDIT_ON_DELIVERY' WHERE "paymentMethod" = 'CREDIT_CARD';

ALTER TABLE "Store" DROP COLUMN "allowCreditCard";

-- Recreate enum without CREDIT_CARD (Postgres can't drop a single enum value).
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM (
  'PIX',
  'CASH_ON_DELIVERY',
  'CREDIT_ON_DELIVERY',
  'DEBIT_ON_DELIVERY',
  'PIX_ON_DELIVERY',
  'PENDING'
);

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";
ALTER TABLE "CashFlowItem" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";

DROP TYPE "PaymentMethod_old";
