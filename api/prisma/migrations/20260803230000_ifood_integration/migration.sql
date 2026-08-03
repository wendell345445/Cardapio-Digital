-- Integração iFood (item 5) — multi-tenant, feature Premium.

-- Novo método de pagamento (pedido pago no iFood)
ALTER TYPE "PaymentMethod" ADD VALUE 'IFOOD';

-- Colunas de conexão iFood na Store (merchantId é o UUID da Merchant-API)
ALTER TABLE "Store" ADD COLUMN "ifoodMerchantId" TEXT;
ALTER TABLE "Store" ADD COLUMN "ifoodAccessToken" TEXT;
ALTER TABLE "Store" ADD COLUMN "ifoodRefreshToken" TEXT;
ALTER TABLE "Store" ADD COLUMN "ifoodTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "ifoodConnectedAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "ifoodStatus" TEXT;
CREATE UNIQUE INDEX "Store_ifoodMerchantId_key" ON "Store"("ifoodMerchantId");

-- Log de eventos iFood (dedupe por eventId)
CREATE TABLE "IFoodEventLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IFoodEventLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IFoodEventLog_storeId_eventId_key" ON "IFoodEventLog"("storeId", "eventId");
CREATE INDEX "IFoodEventLog_storeId_idx" ON "IFoodEventLog"("storeId");
CREATE INDEX "IFoodEventLog_storeId_processedAt_idx" ON "IFoodEventLog"("storeId", "processedAt");
ALTER TABLE "IFoodEventLog" ADD CONSTRAINT "IFoodEventLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Correlação pedido iFood ↔ Order local
CREATE TABLE "IFoodOrderMap" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ifoodOrderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IFoodOrderMap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IFoodOrderMap_orderId_key" ON "IFoodOrderMap"("orderId");
CREATE UNIQUE INDEX "IFoodOrderMap_storeId_ifoodOrderId_key" ON "IFoodOrderMap"("storeId", "ifoodOrderId");
CREATE INDEX "IFoodOrderMap_storeId_idx" ON "IFoodOrderMap"("storeId");
ALTER TABLE "IFoodOrderMap" ADD CONSTRAINT "IFoodOrderMap_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IFoodOrderMap" ADD CONSTRAINT "IFoodOrderMap_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
