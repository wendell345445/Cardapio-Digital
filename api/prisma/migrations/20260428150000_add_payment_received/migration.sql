-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "paymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN "paymentReceivedById" TEXT;

-- AddForeignKey
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_paymentReceivedById_fkey"
  FOREIGN KEY ("paymentReceivedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
