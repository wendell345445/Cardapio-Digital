-- Pedido mínimo para ENTREGA (item 2 do roadmap), em centavos. NULL = sem mínimo.
-- Espelha `freeDeliveryAboveCents`; validado no createOrder só para type=DELIVERY.
ALTER TABLE "Store" ADD COLUMN "minOrderCents" INTEGER;
