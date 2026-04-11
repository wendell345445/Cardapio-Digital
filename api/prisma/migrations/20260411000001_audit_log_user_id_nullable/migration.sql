-- v2.5.6 — AuditLog.userId nullable.
--
-- Antes: `userId String NOT NULL` com FK strict para User.id. O código usava
-- `userId: 'system'` em 6 lugares (trial-suspension.job + 5 webhooks Stripe) pra
-- representar ações sem usuário humano. Como `'system'` não é UUID válido nem existe
-- em User, qualquer um desses paths bombava com FK constraint violation P2003 — e no
-- caso do trial-suspension.job (que usa `prisma.$transaction`), o erro fazia rollback
-- do `Store.update({ status: SUSPENDED })`, deixando lojas trial expiradas pra sempre.
--
-- Migração não-destrutiva: relaxa NOT NULL e mantém a FK (que aceita NULL nativamente).
-- Linhas existentes não são tocadas.

ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
