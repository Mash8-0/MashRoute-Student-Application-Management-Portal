-- Complete invoice generation workflow: invoice requests, editable drafts,
-- final PDF issue, revisions, status watermarks, and tenant/year sequences.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PROOF_UPLOADED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_REQUESTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING_VERIFICATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_VERIFIED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_DRAFT';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_DUE';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INVOICE_AMENDED';

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'ISSUED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'DUE';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'AMENDED';

DO $$ BEGIN
  CREATE TYPE "InvoiceRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Invoice" ALTER COLUMN "invoiceNo" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "originalInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "displayInvoiceNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "revisionNo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sstRate" DECIMAL(5,2);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantShortCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantEmail" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "studentName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "passportNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "studentEmail" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "studentPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "universityName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "programmeName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "intake" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "footerNote" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "watermarkStatus" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issuedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amendedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amendedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Invoice_paymentId_key";
CREATE INDEX IF NOT EXISTS "Invoice_paymentId_idx" ON "Invoice"("paymentId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_originalInvoiceId_idx" ON "Invoice"("originalInvoiceId");

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

DO $$ BEGIN
  ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

INSERT INTO "InvoiceItem" ("id", "invoiceId", "description", "quantity", "unitPrice", "amount", "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || i."id"), i."id", COALESCE(i."invoiceType", 'Payment'), 1, i."grandTotal", i."grandTotal", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Invoice" i
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceItem" item WHERE item."invoiceId" = i."id");

CREATE TABLE IF NOT EXISTS "InvoiceRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "requestedBy" TEXT,
  "requestStatus" "InvoiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "studentId" TEXT,
  CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceRequest_tenantId_idx" ON "InvoiceRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "InvoiceRequest_applicationId_idx" ON "InvoiceRequest"("applicationId");
CREATE INDEX IF NOT EXISTS "InvoiceRequest_paymentId_idx" ON "InvoiceRequest"("paymentId");
CREATE INDEX IF NOT EXISTS "InvoiceRequest_requestStatus_idx" ON "InvoiceRequest"("requestStatus");

DO $$ BEGIN
  ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSequence_tenantId_year_key" ON "InvoiceSequence"("tenantId", "year");
CREATE INDEX IF NOT EXISTS "InvoiceSequence_tenantId_idx" ON "InvoiceSequence"("tenantId");

DO $$ BEGIN
  ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InvoiceAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_tenantId_idx" ON "InvoiceAuditLog"("tenantId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_entityType_entityId_idx" ON "InvoiceAuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_action_idx" ON "InvoiceAuditLog"("action");

DO $$ BEGIN
  ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
