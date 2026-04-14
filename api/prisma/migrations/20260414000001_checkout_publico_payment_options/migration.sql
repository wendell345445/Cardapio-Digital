-- AlterEnum: expande PaymentMethod com novos métodos
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_ON_DELIVERY';
ALTER TYPE "PaymentMethod" ADD VALUE 'DEBIT_ON_DELIVERY';
ALTER TYPE "PaymentMethod" ADD VALUE 'PIX_ON_DELIVERY';

-- AlterTable: flag controla aparição do cartão online no checkout público
ALTER TABLE "Store" ADD COLUMN "allowCreditCard" BOOLEAN NOT NULL DEFAULT false;
