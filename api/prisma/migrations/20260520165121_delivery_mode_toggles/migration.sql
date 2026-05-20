-- AlterTable Store: flags por modalidade de entrega
ALTER TABLE "Store"
  ADD COLUMN "deliveryByDistanceEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deliveryByNeighborhoodEnabled" BOOLEAN NOT NULL DEFAULT true;
