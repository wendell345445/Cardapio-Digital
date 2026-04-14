-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "startsAt"   TIMESTAMP(3);
ALTER TABLE "Coupon" ADD COLUMN "productId"  TEXT;
ALTER TABLE "Coupon" ADD COLUMN "promoPrice" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Coupon_productId_idx" ON "Coupon"("productId");

-- AddForeignKey
ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
