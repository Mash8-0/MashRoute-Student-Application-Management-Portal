-- Safe production migration for Agent/source/commission access.
-- Existing Student.sourceType remains NULL so historical records are not guessed.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'REGISTERED_AGENT';
CREATE TYPE "AgentType" AS ENUM ('REGISTERED_AGENT', 'MANAGED_AGENT', 'REFERRAL_PARTNER');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "StudentSourceType" AS ENUM ('DIRECT_STUDENT', 'REGISTERED_AGENT', 'MANAGED_AGENT', 'REFERRAL_PARTNER');
CREATE TYPE "AgentCommissionType" AS ENUM ('UPFRONT', 'CLAIMABLE');
CREATE TYPE "AgentCommissionStatus" AS ENUM ('NOT_ELIGIBLE', 'PENDING', 'ELIGIBLE', 'CLAIM_SUBMITTED', 'APPROVED', 'SCHEDULED', 'PAID', 'REJECTED', 'CANCELLED');

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "type" "AgentType" NOT NULL,
  "displayName" TEXT NOT NULL, "agencyName" TEXT, "contactPerson" TEXT, "email" TEXT,
  "phone" TEXT, "whatsapp" TEXT, "address" TEXT, "notes" TEXT,
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE', "linkedUserId" TEXT,
  "assignedInternalStaffId" TEXT, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3), CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Agent_linkedUserId_key" ON "Agent"("linkedUserId");
CREATE INDEX "Agent_tenantId_displayName_idx" ON "Agent"("tenantId", "displayName");
CREATE INDEX "Agent_tenantId_type_status_idx" ON "Agent"("tenantId", "type", "status");
CREATE INDEX "Agent_tenantId_email_idx" ON "Agent"("tenantId", "email");
CREATE INDEX "Agent_tenantId_linkedUserId_idx" ON "Agent"("tenantId", "linkedUserId");

ALTER TABLE "Student" ADD COLUMN "sourceType" "StudentSourceType",
  ADD COLUMN "sourceAgentId" TEXT, ADD COLUMN "assignedStaffId" TEXT,
  ADD COLUMN "sourceUpdatedByUserId" TEXT, ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);
CREATE INDEX "Student_tenantId_sourceType_idx" ON "Student"("tenantId", "sourceType");
CREATE INDEX "Student_tenantId_sourceAgentId_idx" ON "Student"("tenantId", "sourceAgentId");
CREATE INDEX "Student_tenantId_assignedStaffId_idx" ON "Student"("tenantId", "assignedStaffId");

CREATE TABLE "AgentCommission" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "agentId" TEXT NOT NULL,
  "universityId" TEXT, "applicationId" TEXT, "commissionType" "AgentCommissionType" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MYR', "grossCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "agentCommission" DOUBLE PRECISION NOT NULL DEFAULT 0, "tenantCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "eligibilityMilestone" TEXT,
  "status" "AgentCommissionStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE', "expectedPayoutDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3), "paymentReference" TEXT, "paymentProofUrl" TEXT, "agentInvoiceUrl" TEXT,
  "internalNotes" TEXT, "createdByUserId" TEXT NOT NULL, "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentCommission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgentCommission_tenantId_status_idx" ON "AgentCommission"("tenantId", "status");
CREATE INDEX "AgentCommission_tenantId_agentId_idx" ON "AgentCommission"("tenantId", "agentId");
CREATE INDEX "AgentCommission_studentId_idx" ON "AgentCommission"("studentId");
CREATE INDEX "AgentCommission_applicationId_idx" ON "AgentCommission"("applicationId");

ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_assignedInternalStaffId_fkey" FOREIGN KEY ("assignedInternalStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_sourceAgentId_fkey" FOREIGN KEY ("sourceAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_sourceUpdatedByUserId_fkey" FOREIGN KEY ("sourceUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentCommission" ADD CONSTRAINT "AgentCommission_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
