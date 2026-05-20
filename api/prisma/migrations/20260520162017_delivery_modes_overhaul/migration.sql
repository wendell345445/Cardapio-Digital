-- AlterTable Store: prep time, free delivery threshold, hide neighborhood fees
ALTER TABLE "Store"
  ADD COLUMN "prepTimeMin" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "freeDeliveryAboveCents" INTEGER,
  ADD COLUMN "hideNeighborhoodFees" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable DeliveryDistance: drop minKm; add etaMin, isAvailable, sortOrder
ALTER TABLE "DeliveryDistance"
  DROP COLUMN "minKm",
  ADD COLUMN "etaMin" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Order: deliveryNeighborhoodId (snapshot, sem FK)
ALTER TABLE "Order"
  ADD COLUMN "deliveryNeighborhoodId" TEXT;

-- CreateTable DeliveryNeighborhood
CREATE TABLE "DeliveryNeighborhood" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fee" DOUBLE PRECISION NOT NULL,
  "etaMin" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryNeighborhood_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryNeighborhood_storeId_name_key" ON "DeliveryNeighborhood"("storeId", "name");
CREATE INDEX "DeliveryNeighborhood_storeId_idx" ON "DeliveryNeighborhood"("storeId");

ALTER TABLE "DeliveryNeighborhood"
  ADD CONSTRAINT "DeliveryNeighborhood_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
