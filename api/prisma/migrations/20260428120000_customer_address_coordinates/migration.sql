-- Coordenadas opcionais do endereço do cliente (Google Geocoding ou input
-- manual do Maps). Quando presentes, o checkout pula geocoding na próxima
-- compra do mesmo endereço — economiza cota e cobre o caso em que Google
-- não acha o ponto (cliente cola lat/lng do Maps uma vez, fica gravado).

ALTER TABLE "CustomerAddress" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "CustomerAddress" ADD COLUMN "longitude" DOUBLE PRECISION;
