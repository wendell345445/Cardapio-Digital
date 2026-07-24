-- Destaques de Produtos (item 3 do roadmap). Quando true, o produto aparece na
-- seção "Destaques" (carrossel no topo do cardápio público).
ALTER TABLE "Product" ADD COLUMN "isHighlight" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_storeId_isHighlight_idx" ON "Product"("storeId", "isHighlight");
