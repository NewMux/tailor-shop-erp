ALTER TABLE "tailoringOrders" ADD COLUMN IF NOT EXISTS "saleId" integer;

CREATE UNIQUE INDEX IF NOT EXISTS "tailoringOrders_saleId_unique" ON "tailoringOrders" ("saleId") WHERE "saleId" IS NOT NULL;
