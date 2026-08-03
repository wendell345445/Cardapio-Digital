-- Itens de pedidos externos (iFood) não têm Product local — productId passa a aceitar NULL.
-- O snapshot productName/unitPrice/additionals já desacopla a exibição.
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
