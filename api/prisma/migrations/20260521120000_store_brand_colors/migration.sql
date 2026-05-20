-- Personalização visual do cardápio público (v2.9):
-- primaryColor / secondaryColor em HEX (#RRGGBB). NULL = usa o tema default (vermelho).
ALTER TABLE "Store" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "Store" ADD COLUMN "secondaryColor" TEXT;
