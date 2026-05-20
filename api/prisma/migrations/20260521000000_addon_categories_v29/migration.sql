-- ─── v2.9: Adicionais reformulados ───────────────────────────────────────────
-- Substitui ProductAdditional (lista flat por produto, sem reuso) por:
--   - AddonCategory: agrupa adicionais por tema ("Acompanhamentos", "Bebidas")
--   - Addon: item cadastrado UMA vez por loja, com foto/preço
--   - ProductAddon: tabela associativa N:N (mesmo adicional em N produtos)
--
-- Data-copy: deduplica ProductAdditional existentes por (storeId, name, price)
-- numa única AddonCategory "Geral" por loja, e cria ProductAddon ligando cada
-- produto original ao Addon resultante. OrderItemAdditional (snapshot dos
-- adicionais em pedidos já feitos) não é tocado — pedidos antigos seguem íntegros.

-- 1. AddonCategory
CREATE TABLE "AddonCategory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AddonCategory_storeId_name_key" ON "AddonCategory"("storeId", "name");
CREATE INDEX "AddonCategory_storeId_idx" ON "AddonCategory"("storeId");
ALTER TABLE "AddonCategory" ADD CONSTRAINT "AddonCategory_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Addon
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Addon_storeId_categoryId_name_key" ON "Addon"("storeId", "categoryId", "name");
CREATE INDEX "Addon_storeId_idx" ON "Addon"("storeId");
CREATE INDEX "Addon_categoryId_idx" ON "Addon"("categoryId");
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "AddonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. ProductAddon (associativa N:N)
CREATE TABLE "ProductAddon" (
    "productId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("productId", "addonId")
);
CREATE INDEX "ProductAddon_addonId_idx" ON "ProductAddon"("addonId");
ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_addonId_fkey"
    FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Data-copy ───────────────────────────────────────────────────────────────
-- Só faz sentido se existirem ProductAdditional pra migrar. Lojas sem
-- adicionais cadastrados não ganham a categoria "Geral".

-- 4. Cria 1 AddonCategory "Geral" por loja que tenha ao menos 1 ProductAdditional
INSERT INTO "AddonCategory" ("id", "storeId", "name", "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", 'Geral', 0, true, NOW(), NOW()
FROM "Store" s
WHERE EXISTS (
    SELECT 1 FROM "ProductAdditional" pa
    JOIN "Product" p ON p."id" = pa."productId"
    WHERE p."storeId" = s."id"
);

-- 5. Cria Addons únicos por (storeId, name, price) na categoria "Geral"
-- usando DISTINCT pra deduplicar "Bacon R$5" que estava em N produtos.
-- isActive do Addon = true (se TINHA pelo menos 1 ProductAdditional ativo do nome)
-- ou false se TODOS os ProductAdditional com aquele nome+preço estavam inativos.
WITH dedup AS (
    SELECT
        p."storeId",
        pa."name",
        pa."price",
        bool_or(pa."isActive") AS any_active
    FROM "ProductAdditional" pa
    JOIN "Product" p ON p."id" = pa."productId"
    GROUP BY p."storeId", pa."name", pa."price"
)
INSERT INTO "Addon" ("id", "storeId", "categoryId", "name", "price", "isActive", "order", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    d."storeId",
    ac."id",
    d."name",
    d."price",
    d."any_active",
    0,
    NOW(),
    NOW()
FROM dedup d
JOIN "AddonCategory" ac ON ac."storeId" = d."storeId" AND ac."name" = 'Geral';

-- 6. Cria ProductAddon ligando cada ProductAdditional original ao Addon resultante.
-- Match por (storeId, name, price).
INSERT INTO "ProductAddon" ("productId", "addonId", "order")
SELECT pa."productId", a."id", 0
FROM "ProductAdditional" pa
JOIN "Product" p ON p."id" = pa."productId"
JOIN "Addon" a ON a."storeId" = p."storeId" AND a."name" = pa."name" AND a."price" = pa."price"
ON CONFLICT ("productId", "addonId") DO NOTHING;

-- 7. Drop ProductAdditional
DROP TABLE "ProductAdditional";
