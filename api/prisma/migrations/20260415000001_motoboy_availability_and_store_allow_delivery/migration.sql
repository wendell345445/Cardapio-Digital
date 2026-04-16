-- Motoboy operational state: availability-for-today (lazy reset) + round-robin pointer
ALTER TABLE "User"
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "lastAssignedAt" TIMESTAMP(3);

-- Store: explicit toggle to accept DELIVERY orders. Default true to preserve current behavior.
ALTER TABLE "Store"
  ADD COLUMN "allowDelivery" BOOLEAN NOT NULL DEFAULT true;
