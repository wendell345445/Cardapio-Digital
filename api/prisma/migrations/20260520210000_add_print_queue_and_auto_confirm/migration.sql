-- Adiciona flag Store.autoConfirmOrders e a tabela PrintJob (fila de impressão
-- consumida pelo app desktop Menuziprinter via polling em /api/print/pending).

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PRINTED', 'FAILED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "autoConfirmOrders" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_orderId_key" ON "PrintJob"("orderId");

-- CreateIndex
CREATE INDEX "PrintJob_storeId_status_idx" ON "PrintJob"("storeId", "status");

-- CreateIndex
CREATE INDEX "PrintJob_printedAt_idx" ON "PrintJob"("printedAt");

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
