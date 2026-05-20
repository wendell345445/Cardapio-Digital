-- AlterTable: rastreia o último GREETING enviado por conversa para cooldown de 90min
ALTER TABLE "Conversation" ADD COLUMN "lastGreetingAt" TIMESTAMP(3);
