-- Remove dietary flags. Foram adicionadas em 20260414000003_product_dietary_flags
-- mas nunca usadas em código (sem referência no schema.prisma, api/src ou web/src).
-- Drift detectado pelo prisma migrate dev.
ALTER TABLE "Product" DROP COLUMN "isGlutenFree";
ALTER TABLE "Product" DROP COLUMN "isLactoseFree";
ALTER TABLE "Product" DROP COLUMN "isVegan";
ALTER TABLE "Product" DROP COLUMN "isVegetarian";
