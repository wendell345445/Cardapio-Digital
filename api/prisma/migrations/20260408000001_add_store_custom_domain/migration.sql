-- AlterTable
ALTER TABLE "Store" ADD COLUMN "customDomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Store_customDomain_key" ON "Store"("customDomain");

-- CreateIndex
CREATE INDEX "Store_customDomain_idx" ON "Store"("customDomain");
