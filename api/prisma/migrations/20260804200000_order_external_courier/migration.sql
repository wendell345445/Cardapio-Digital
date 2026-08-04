-- Entregador avulso/terceiro (não cadastrado): despachar sem motoboy do quadro.
ALTER TABLE "Order" ADD COLUMN "externalCourierName" TEXT;
