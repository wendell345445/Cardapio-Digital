-- Constraint anterior @@unique([tableId, status]) impedia que uma mesa tivesse
-- duas sessões CLOSED no histórico — fechar a 2ª sessão violava o índice.
-- A intenção real é "só pode haver UMA sessão OPEN por mesa". Implementado
-- como índice parcial (Postgres) que Prisma não modela direto.
DROP INDEX IF EXISTS "TableSession_tableId_status_key";

CREATE UNIQUE INDEX "TableSession_tableId_open_unique"
  ON "TableSession"("tableId")
  WHERE status = 'OPEN';
