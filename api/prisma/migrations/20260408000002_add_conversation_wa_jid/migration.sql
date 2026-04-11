-- TASK-121 fix LID sessions: adicionar waJid na Conversation
-- Armazena o JID real do Baileys (pode ser LID @lid ou PN @s.whatsapp.net)
-- para envio confiável em sessões LID (Baileys 7.x)

ALTER TABLE "Conversation" ADD COLUMN "waJid" TEXT;
