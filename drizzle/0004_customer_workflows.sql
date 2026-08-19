ALTER TABLE "shopSettings" ADD COLUMN IF NOT EXISTS "invoiceTerms" text;
ALTER TABLE "inventoryItems" ADD COLUMN IF NOT EXISTS "inventoryType" text NOT NULL DEFAULT 'material';
ALTER TABLE "inventoryItems" ADD COLUMN IF NOT EXISTS "size" varchar(60);
ALTER TABLE "inventoryItems" ADD COLUMN IF NOT EXISTS "salePrice" numeric(12,3) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "staffDocuments" (
  "id" serial PRIMARY KEY,
  "staffProfileId" integer NOT NULL,
  "label" varchar(120) NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "contentType" varchar(120) NOT NULL,
  "storageKey" varchar(500) NOT NULL,
  "storageUrl" varchar(600) NOT NULL,
  "uploadedBy" integer NOT NULL,
  "uploadedAt" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "absenceReason" varchar(40);
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "absenceDetails" text;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "absenceDocumentId" integer;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "absenceDeduction" numeric(12,3) NOT NULL DEFAULT 0;
UPDATE "inventoryItems" SET "inventoryType" = 'material' WHERE "inventoryType" IS NULL;
UPDATE "inventoryItems" SET "salePrice" = "costPerUnit" WHERE "salePrice" IS NULL OR "salePrice" = 0;
UPDATE "attendance" SET "absenceDeduction" = 0 WHERE "absenceDeduction" IS NULL;
UPDATE "shopSettings" SET "invoiceTerms" = 'Payment is due according to the agreed terms. Returns and exchanges are subject to store policy.' WHERE "invoiceTerms" IS NULL;
