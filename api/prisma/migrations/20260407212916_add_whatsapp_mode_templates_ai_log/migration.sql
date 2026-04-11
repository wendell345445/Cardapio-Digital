-- CreateEnum
CREATE TYPE "WhatsAppMode" AS ENUM ('WHATSAPP', 'WHATSAPP_AI');

-- CreateEnum
CREATE TYPE "WhatsAppEventType" AS ENUM ('ORDER_CREATED', 'WAITING_PAYMENT', 'CONFIRMED', 'PREPARING', 'DISPATCHED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'MOTOBOY_ASSIGNED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "whatsappMode" "WhatsAppMode" NOT NULL DEFAULT 'WHATSAPP';

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "eventType" "WhatsAppEventType" NOT NULL,
    "template" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteractionLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sqlGenerated" TEXT,
    "response" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_storeId_idx" ON "WhatsAppTemplate"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_storeId_eventType_key" ON "WhatsAppTemplate"("storeId", "eventType");

-- CreateIndex
CREATE INDEX "AIInteractionLog_storeId_createdAt_idx" ON "AIInteractionLog"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
