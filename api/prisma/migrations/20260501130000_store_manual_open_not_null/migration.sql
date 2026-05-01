-- Caixa fechado por padrão. Cardápio público só fica aberto com manualOpen=true
-- E dentro do horário de atendimento (AND, validado em calcStoreStatus).
-- Lojas existentes com NULL viram false (caixa fechado, owner precisa abrir).
UPDATE "Store" SET "manualOpen" = false WHERE "manualOpen" IS NULL;
ALTER TABLE "Store" ALTER COLUMN "manualOpen" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "manualOpen" SET DEFAULT false;
