-- Application-scoped Initial/University and Other payment sections.
-- Existing EMGS records remain unchanged and no historical fees are backfilled.
CREATE TYPE "PaymentFeeSectionType" AS ENUM ('INITIAL_UNIVERSITY', 'OTHER');
CREATE TYPE "FeeSectionStatus" AS ENUM ('NOT_CONFIGURED', 'PAYMENT_PENDING', 'PROOF_UPLOADED', 'UNDER_VERIFICATION', 'PARTIALLY_PAID', 'FULLY_PAID', 'OVERPAID', 'CANCELLED', 'NOT_REQUIRED');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PROOF_UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'REVERSED', 'REFUNDED');
CREATE TYPE "SstTreatment" AS ENUM ('NO_SST', 'SST_INCLUDED', 'ADD_SST', 'CUSTOM_SST_RATE');
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'REVERSED', 'REFUNDED');

CREATE TABLE "PaymentFeeSection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "applicationId" TEXT NOT NULL,
  "sectionType" "PaymentFeeSectionType" NOT NULL, "category" TEXT, "customLabel" TEXT, "description" TEXT,
  "currency" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "destinationType" "PaymentDestinationType" NOT NULL,
  "destinationAccountId" TEXT NOT NULL, "destinationSnapshot" JSONB NOT NULL, "allowPartialPayment" BOOLEAN NOT NULL DEFAULT false,
  "minimumPartialAmount" DECIMAL(12,2), "studentNote" TEXT, "internalNote" TEXT,
  "status" "FeeSectionStatus" NOT NULL DEFAULT 'PAYMENT_PENDING', "activeSectionKey" TEXT,
  "createdByUserId" TEXT NOT NULL, "updatedByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "cancelledAt" TIMESTAMP(3), CONSTRAINT "PaymentFeeSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentFeeSection_activeSectionKey_key" ON "PaymentFeeSection"("activeSectionKey");
CREATE INDEX "PaymentFeeSection_tenantId_applicationId_sectionType_status_idx" ON "PaymentFeeSection"("tenantId", "applicationId", "sectionType", "status");
CREATE INDEX "PaymentFeeSection_tenantId_studentId_idx" ON "PaymentFeeSection"("tenantId", "studentId");
CREATE INDEX "PaymentFeeSection_destinationAccountId_idx" ON "PaymentFeeSection"("destinationAccountId");

CREATE TABLE "PaymentFeeLine" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "feeCode" TEXT NOT NULL, "description" TEXT NOT NULL,
  "baseAmount" DECIMAL(12,2) NOT NULL, "sstTreatment" "SstTreatment" NOT NULL DEFAULT 'NO_SST', "sstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "preTaxAmount" DECIMAL(12,2) NOT NULL, "sstAmount" DECIMAL(12,2) NOT NULL, "finalAmount" DECIMAL(12,2) NOT NULL,
  "calculationSnapshot" JSONB NOT NULL, "notes" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentFeeLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentFeeLine_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PaymentFeeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentFeeLine_sectionId_feeCode_key" ON "PaymentFeeLine"("sectionId", "feeCode");
CREATE INDEX "PaymentFeeLine_tenantId_sectionId_idx" ON "PaymentFeeLine"("tenantId", "sectionId");

CREATE TABLE "PaymentSectionTransaction" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "sectionId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL, "paymentDate" TIMESTAMP(3) NOT NULL, "paymentMethod" TEXT NOT NULL, "paidBy" TEXT NOT NULL,
  "destinationType" "PaymentDestinationType" NOT NULL, "destinationAccountId" TEXT NOT NULL, "destinationSnapshot" JSONB NOT NULL,
  "transactionReference" TEXT, "note" TEXT, "proofFileUrl" TEXT, "proofHash" TEXT,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PROOF_UPLOADED', "submittedByUserId" TEXT NOT NULL,
  "verifiedByUserId" TEXT, "verifiedAt" TIMESTAMP(3), "rejectedByUserId" TEXT, "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentSectionTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentSectionTransaction_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PaymentFeeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PaymentSectionTransaction_tenantId_applicationId_status_idx" ON "PaymentSectionTransaction"("tenantId", "applicationId", "status");
CREATE INDEX "PaymentSectionTransaction_tenantId_transactionReference_idx" ON "PaymentSectionTransaction"("tenantId", "transactionReference");
CREATE INDEX "PaymentSectionTransaction_tenantId_proofHash_idx" ON "PaymentSectionTransaction"("tenantId", "proofHash");
CREATE INDEX "PaymentSectionTransaction_sectionId_idx" ON "PaymentSectionTransaction"("sectionId");

CREATE TABLE "PaymentSectionAllocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "feeLineId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSectionAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentSectionAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentSectionTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentSectionAllocation_feeLineId_fkey" FOREIGN KEY ("feeLineId") REFERENCES "PaymentFeeLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentSectionAllocation_transactionId_feeLineId_key" ON "PaymentSectionAllocation"("transactionId", "feeLineId");
CREATE INDEX "PaymentSectionAllocation_tenantId_feeLineId_idx" ON "PaymentSectionAllocation"("tenantId", "feeLineId");

CREATE TABLE "PaymentSectionReceipt" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "sectionId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL, "receiptNo" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL,
  "destinationType" "PaymentDestinationType" NOT NULL, "destinationSnapshot" JSONB NOT NULL, "remainingBalance" DECIMAL(12,2) NOT NULL,
  "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED', "verifiedByUserId" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL,
  "documentUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSectionReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentSectionReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentSectionTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentSectionReceipt_transactionId_key" ON "PaymentSectionReceipt"("transactionId");
CREATE UNIQUE INDEX "PaymentSectionReceipt_tenantId_receiptNo_key" ON "PaymentSectionReceipt"("tenantId", "receiptNo");
CREATE INDEX "PaymentSectionReceipt_tenantId_applicationId_idx" ON "PaymentSectionReceipt"("tenantId", "applicationId");
CREATE INDEX "PaymentSectionReceipt_sectionId_idx" ON "PaymentSectionReceipt"("sectionId");

CREATE TABLE "StudentPaymentCredit" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "applicationId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentPaymentCredit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentPaymentCredit_transactionId_key" ON "StudentPaymentCredit"("transactionId");
CREATE INDEX "StudentPaymentCredit_tenantId_studentId_currency_status_idx" ON "StudentPaymentCredit"("tenantId", "studentId", "currency", "status");

CREATE TABLE "FinancialDocumentSequence" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentType" TEXT NOT NULL, "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FinancialDocumentSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialDocumentSequence_tenantId_documentType_year_key" ON "FinancialDocumentSequence"("tenantId", "documentType", "year");
CREATE INDEX "FinancialDocumentSequence_tenantId_documentType_idx" ON "FinancialDocumentSequence"("tenantId", "documentType");
