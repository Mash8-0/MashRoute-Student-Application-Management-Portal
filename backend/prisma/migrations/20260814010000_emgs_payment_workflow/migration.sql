-- Application-scoped EMGS payment workflow. Existing financial rows are left
-- untouched; historical offer letters are NOT assigned invented balances.

CREATE TYPE "PaymentDestinationType" AS ENUM ('TENANT_ACCOUNT','UNIVERSITY_ACCOUNT','EMGS_ACCOUNT','OTHER_APPROVED_ACCOUNT');
CREATE TYPE "EmgsPaymentStatus" AS ENUM ('NOT_CONFIGURED','PAYMENT_PENDING','PROOF_UPLOADED','UNDER_VERIFICATION','PARTIALLY_PAID','FULLY_PAID','OVERPAID','REJECTED','REFUNDED','CANCELLED','NOT_REQUIRED');
CREATE TYPE "EmgsFeeStatus" AS ENUM ('PAYMENT_PENDING','PARTIALLY_PAID','FULLY_PAID','OVERPAID','CANCELLED','NOT_REQUIRED');
CREATE TYPE "EmgsTransactionStatus" AS ENUM ('PROOF_UPLOADED','UNDER_VERIFICATION','VERIFIED','REJECTED','REFUNDED');

ALTER TABLE "Application" ADD COLUMN "emgsPaymentStatus" "EmgsPaymentStatus" NOT NULL DEFAULT 'NOT_CONFIGURED';
ALTER TABLE "Application" ADD COLUMN "emgsSetupDecision" TEXT;
ALTER TABLE "Application" ADD COLUMN "emgsNotRequiredReason" TEXT;
ALTER TABLE "Application" ADD COLUMN "emgsNotRequiredNote" TEXT;
ALTER TABLE "Application" ADD COLUMN "emgsSetupDecidedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "emgsSetupDecidedById" TEXT;

CREATE TABLE "PaymentDestinationAccount" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"accountType" "PaymentDestinationType" NOT NULL,"universityId" TEXT,"label" TEXT NOT NULL,"accountHolderName" TEXT NOT NULL,"bankName" TEXT NOT NULL,"accountNumber" TEXT NOT NULL,"maskedAccountNumber" TEXT NOT NULL,"currency" TEXT NOT NULL DEFAULT 'MYR',"branchName" TEXT,"swiftBic" TEXT,"iban" TEXT,"routingNumber" TEXT,"paymentInstructions" TEXT,"qrCodeDocumentId" TEXT,"isDefault" BOOLEAN NOT NULL DEFAULT false,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdByUserId" TEXT NOT NULL,"updatedByUserId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"archivedAt" TIMESTAMP(3));
CREATE TABLE "ApplicationPaymentAccount" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"studentId" TEXT NOT NULL,"applicationId" TEXT NOT NULL UNIQUE,"status" "EmgsPaymentStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',"currency" TEXT NOT NULL DEFAULT 'MYR',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "EmgsFeeItem" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"studentId" TEXT NOT NULL,"applicationId" TEXT NOT NULL,"paymentAccountId" TEXT NOT NULL,"feeType" TEXT NOT NULL DEFAULT 'EMGS',"description" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL DEFAULT 'MYR',"dueDate" TIMESTAMP(3) NOT NULL,"destinationType" "PaymentDestinationType" NOT NULL,"destinationAccountId" TEXT NOT NULL,"destinationSnapshot" JSONB NOT NULL,"allowPartialPayment" BOOLEAN NOT NULL DEFAULT false,"minimumPartialAmount" DECIMAL(12,2),"status" "EmgsFeeStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',"activeApplicationKey" TEXT UNIQUE,"studentVisibleNote" TEXT,"internalNote" TEXT,"legacyPaymentId" TEXT,"invoiceId" TEXT,"createdByUserId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"cancelledAt" TIMESTAMP(3));
CREATE TABLE "EmgsPaymentTransaction" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"studentId" TEXT NOT NULL,"applicationId" TEXT NOT NULL,"feeItemId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"paymentDate" TIMESTAMP(3) NOT NULL,"paymentMethod" TEXT NOT NULL,"paidBy" TEXT NOT NULL,"destinationType" "PaymentDestinationType" NOT NULL,"destinationAccountId" TEXT NOT NULL,"destinationSnapshot" JSONB NOT NULL,"transactionReference" TEXT,"note" TEXT,"proofDocumentId" TEXT,"proofFileUrl" TEXT,"proofHash" TEXT,"status" "EmgsTransactionStatus" NOT NULL DEFAULT 'PROOF_UPLOADED',"submittedByUserId" TEXT NOT NULL,"verifiedByUserId" TEXT,"verifiedAt" TIMESTAMP(3),"rejectedByUserId" TEXT,"rejectedAt" TIMESTAMP(3),"rejectionReason" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "EmgsPaymentAllocation" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"feeItemId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("transactionId","feeItemId"));
CREATE TABLE "EmgsPaymentReceipt" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"studentId" TEXT NOT NULL,"applicationId" TEXT NOT NULL,"transactionId" TEXT NOT NULL UNIQUE,"receiptNo" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"destinationType" "PaymentDestinationType" NOT NULL,"destinationSnapshot" JSONB NOT NULL,"remainingBalance" DECIMAL(12,2) NOT NULL,"verifiedByUserId" TEXT NOT NULL,"verifiedAt" TIMESTAMP(3) NOT NULL,"documentUrl" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("tenantId","receiptNo"));
CREATE TABLE "EmgsPaymentReversal" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"applicationId" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"currency" TEXT NOT NULL,"reason" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'COMPLETED',"createdByUserId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "PaymentWorkflowTask" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"applicationId" TEXT NOT NULL,"taskType" TEXT NOT NULL,"title" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"createdById" TEXT NOT NULL,"completedById" TEXT,"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "FinancialAuditLog" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL,"actorId" TEXT,"entityType" TEXT NOT NULL,"entityId" TEXT NOT NULL,"action" TEXT NOT NULL,"oldValue" JSONB,"newValue" JSONB,"reason" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);

ALTER TABLE "Invoice" ADD COLUMN "paymentAccountSnapshot" JSONB;
ALTER TABLE "Invoice" ADD COLUMN "paymentDestinationType" "PaymentDestinationType";
ALTER TABLE "Invoice" ADD COLUMN "destinationAccountId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "emgsFeeItemId" TEXT;

CREATE INDEX "PaymentDestinationAccount_tenant_type_currency_active_idx" ON "PaymentDestinationAccount"("tenantId","accountType","currency","isActive");
CREATE INDEX "PaymentDestinationAccount_tenant_university_currency_active_idx" ON "PaymentDestinationAccount"("tenantId","universityId","currency","isActive");
CREATE INDEX "ApplicationPaymentAccount_tenant_student_idx" ON "ApplicationPaymentAccount"("tenantId","studentId");
CREATE INDEX "EmgsFeeItem_tenant_application_status_idx" ON "EmgsFeeItem"("tenantId","applicationId","status");
CREATE INDEX "EmgsPaymentTransaction_tenant_application_status_idx" ON "EmgsPaymentTransaction"("tenantId","applicationId","status");
CREATE INDEX "EmgsPaymentTransaction_tenant_reference_idx" ON "EmgsPaymentTransaction"("tenantId","transactionReference");
CREATE INDEX "EmgsPaymentTransaction_tenant_proof_hash_idx" ON "EmgsPaymentTransaction"("tenantId","proofHash");
CREATE INDEX "EmgsPaymentTransaction_fee_item_idx" ON "EmgsPaymentTransaction"("feeItemId");
CREATE INDEX "EmgsPaymentAllocation_tenant_fee_item_idx" ON "EmgsPaymentAllocation"("tenantId","feeItemId");
CREATE INDEX "EmgsPaymentReceipt_tenant_application_idx" ON "EmgsPaymentReceipt"("tenantId","applicationId");
CREATE INDEX "EmgsPaymentReversal_tenant_application_idx" ON "EmgsPaymentReversal"("tenantId","applicationId");
CREATE INDEX "EmgsPaymentReversal_tenant_transaction_idx" ON "EmgsPaymentReversal"("tenantId","transactionId");
CREATE INDEX "PaymentWorkflowTask_tenant_application_status_idx" ON "PaymentWorkflowTask"("tenantId","applicationId","status");
CREATE INDEX "FinancialAuditLog_tenant_entity_idx" ON "FinancialAuditLog"("tenantId","entityType","entityId");

-- Account and ledger rows are always tenant/application scoped. Restricting
-- FKs preserve historical snapshots while preventing cross-resource records.
ALTER TABLE "PaymentDestinationAccount" ADD CONSTRAINT "PaymentDestinationAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ApplicationPaymentAccount" ADD CONSTRAINT "ApplicationPaymentAccount_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE;
ALTER TABLE "EmgsFeeItem" ADD CONSTRAINT "EmgsFeeItem_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "ApplicationPaymentAccount"("id") ON DELETE RESTRICT;
ALTER TABLE "EmgsFeeItem" ADD CONSTRAINT "EmgsFeeItem_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "PaymentDestinationAccount"("id") ON DELETE RESTRICT;
ALTER TABLE "EmgsPaymentTransaction" ADD CONSTRAINT "EmgsPaymentTransaction_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "EmgsFeeItem"("id") ON DELETE RESTRICT;
ALTER TABLE "EmgsPaymentAllocation" ADD CONSTRAINT "EmgsPaymentAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "EmgsPaymentTransaction"("id") ON DELETE RESTRICT;
ALTER TABLE "EmgsPaymentAllocation" ADD CONSTRAINT "EmgsPaymentAllocation_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "EmgsFeeItem"("id") ON DELETE RESTRICT;
ALTER TABLE "EmgsPaymentReceipt" ADD CONSTRAINT "EmgsPaymentReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "EmgsPaymentTransaction"("id") ON DELETE RESTRICT;

-- No historical EMGS fees are created here. Admins must review legacy offer
-- letters and set up fees manually to avoid inventing balances.
