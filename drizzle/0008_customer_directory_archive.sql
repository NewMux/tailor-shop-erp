ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "customers_is_active_idx" ON "customers" ("isActive");
