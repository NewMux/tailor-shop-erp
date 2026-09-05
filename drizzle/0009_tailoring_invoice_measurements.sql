ALTER TABLE "tailoringOrders" ADD COLUMN IF NOT EXISTS "includeMeasurementsOnInvoice" boolean NOT NULL DEFAULT false;
