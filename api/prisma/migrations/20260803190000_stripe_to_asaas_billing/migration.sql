-- Item 4 do roadmap: migração de billing Stripe → Asaas.
-- Corte limpo: renomeia as 3 colunas stripe*, adiciona campos do Asaas, e zera
-- os ids legados (as lojas re-assinam via Asaas; a Stripe já estava quebrada).

-- CreateEnum
CREATE TYPE "BillingMethod" AS ENUM ('CARD', 'PIX_AUTO');

-- Rename das colunas de billing (preserva dados, mas serão zerados abaixo)
ALTER TABLE "Store" RENAME COLUMN "stripeCustomerId" TO "asaasCustomerId";
ALTER TABLE "Store" RENAME COLUMN "stripeSubscriptionId" TO "asaasSubscriptionId";
ALTER TABLE "Store" RENAME COLUMN "stripeTrialEndsAt" TO "trialEndsAt";

-- Novos campos Asaas
ALTER TABLE "Store" ADD COLUMN "asaasCheckoutId" TEXT;
ALTER TABLE "Store" ADD COLUMN "asaasPixAuthId" TEXT;
ALTER TABLE "Store" ADD COLUMN "billingMethod" "BillingMethod";

-- Corte limpo: ids Stripe herdados não valem no Asaas. `trialEndsAt` é preservado
-- (data agnóstica de provedor, fonte-de-verdade do cron de suspensão).
UPDATE "Store" SET "asaasCustomerId" = NULL, "asaasSubscriptionId" = NULL;
