ALTER TABLE "inventoryItems" ADD COLUMN IF NOT EXISTS "rollCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "inventoryItems" ADD COLUMN IF NOT EXISTS "metersPerRoll" numeric(12,3);
