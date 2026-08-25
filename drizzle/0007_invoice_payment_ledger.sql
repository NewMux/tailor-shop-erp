CREATE TABLE IF NOT EXISTS "invoicePayments" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoiceId" integer NOT NULL,
  "amount" numeric(12,3) NOT NULL,
  "paymentMethod" "payment_method" NOT NULL,
  "reference" varchar(160),
  "previousPaidAmount" numeric(12,3) DEFAULT '0' NOT NULL,
  "paidTotal" numeric(12,3) NOT NULL,
  "remainingAmount" numeric(12,3) NOT NULL,
  "createdBy" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invoicePayments_invoiceId_createdAt_idx" ON "invoicePayments" ("invoiceId", "createdAt");

WITH eligible AS (
  SELECT
    i."id" AS "invoiceId",
    p."amount" AS "amount",
    p."method" AS "paymentMethod",
    p."reference" AS "reference",
    p."createdBy" AS "createdBy",
    p."createdAt" AS "createdAt",
    s."total" AS "total",
    COALESCE(SUM(p."amount") OVER (
      PARTITION BY i."id"
      ORDER BY p."createdAt", p."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS "previousPaidAmount"
  FROM "invoices" i
  INNER JOIN "sales" s ON s."id" = i."saleId"
  INNER JOIN "posPayments" p ON p."saleId" = s."id"
  WHERE NOT EXISTS (
    SELECT 1 FROM "invoicePayments" existing WHERE existing."invoiceId" = i."id"
  )
)
INSERT INTO "invoicePayments" (
  "invoiceId", "amount", "paymentMethod", "reference", "previousPaidAmount", "paidTotal", "remainingAmount", "createdBy", "createdAt"
)
SELECT
  "invoiceId",
  "amount",
  "paymentMethod",
  "reference",
  "previousPaidAmount",
  LEAST("total", "previousPaidAmount" + "amount"),
  GREATEST(0, "total" - ("previousPaidAmount" + "amount")),
  "createdBy",
  "createdAt"
FROM eligible
WHERE "amount" > 0;

INSERT INTO "invoicePayments" (
  "invoiceId", "amount", "paymentMethod", "reference", "previousPaidAmount", "paidTotal", "remainingAmount", "createdBy", "createdAt"
)
SELECT
  i."id",
  s."paidAmount",
  s."paymentMethod",
  'Historical payment imported from invoice paid amount',
  0,
  s."paidAmount",
  GREATEST(0, s."total" - s."paidAmount"),
  s."createdBy",
  i."issuedAt"
FROM "invoices" i
INNER JOIN "sales" s ON s."id" = i."saleId"
WHERE s."paidAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "invoicePayments" existing WHERE existing."invoiceId" = i."id"
  );
