-- Add notifyOnStatusChange flag (default false) and customerSessionId to Order
ALTER TABLE "Order" ADD COLUMN "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "customerSessionId" TEXT;

-- Index para buscar pedidos da sessão do navegador do cliente
CREATE INDEX "Order_storeId_customerSessionId_idx" ON "Order"("storeId", "customerSessionId");
