-- Downgrade agendado: plano que passará a valer no próximo ciclo (padrão de mercado —
-- mantém as features do plano atual até o fim do ciclo já pago). NULL = sem downgrade pendente.
ALTER TABLE "Store" ADD COLUMN "pendingPlan" "StorePlan";
