-- TASK-130 (parte 2): cliente não digita mais WhatsApp no checkout. O número
-- é capturado no opt-in via inbound. Pedido nasce sem clientWhatsapp.
ALTER TABLE "Order" ALTER COLUMN "clientWhatsapp" DROP NOT NULL;
