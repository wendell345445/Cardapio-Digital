-- AlterTable: rastrear número WhatsApp pareado por loja para evitar pareamento
-- duplicado (mesma conta em múltiplas lojas → cada uma envia greeting próprio).
ALTER TABLE "Store" ADD COLUMN "whatsappPairedNumber" TEXT;

-- CreateIndex: garante unicidade global do número pareado.
CREATE UNIQUE INDEX "Store_whatsappPairedNumber_key" ON "Store"("whatsappPairedNumber");
