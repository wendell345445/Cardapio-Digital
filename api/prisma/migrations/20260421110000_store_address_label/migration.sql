-- Endereço "legível" associado às coordenadas da loja.
-- Exibido no admin (Localização da loja) para que o usuário entenda que aquelas
-- coordenadas correspondem ao endereço esperado.

ALTER TABLE "Store" ADD COLUMN "addressLabel" TEXT;
