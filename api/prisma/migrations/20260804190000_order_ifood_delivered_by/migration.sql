-- iFood: persiste quem faz a entrega (MERCHANT vs IFOOD) pra decidir dispatch outbound.
ALTER TABLE "Order" ADD COLUMN "ifoodDeliveredBy" TEXT;
