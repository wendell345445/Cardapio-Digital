-- iFood: pedido exige código de entrega (evento DELIVERY_DROP_CODE_REQUESTED).
ALTER TABLE "Order" ADD COLUMN "ifoodRequiresDeliveryCode" BOOLEAN NOT NULL DEFAULT false;
