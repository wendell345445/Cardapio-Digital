-- Drop delivery-by-neighborhood infrastructure. From now on, delivery fee is
-- always computed by distance (Haversine between Store.lat/lng and customer
-- lat/lng resolved via geocoding).

-- Drop table with bairros
DROP TABLE IF EXISTS "DeliveryNeighborhood";

-- Drop Store.deliveryMode column (no longer needed — mode is implicitly DISTANCE)
ALTER TABLE "Store" DROP COLUMN IF EXISTS "deliveryMode";

-- Drop the enum (unused after the column drop)
DROP TYPE IF EXISTS "DeliveryMode";
