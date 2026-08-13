-- Dynamic, tenant-scoped intake management. All additions are nullable or new
-- tables so existing applications and their plain-text intake values survive.
CREATE TYPE "IntakeType" AS ENUM ('REGULAR', 'LATE_INTAKE', 'LATE_REGISTRATION', 'LATE_ARRIVAL', 'SPECIAL_INTAKE', 'MONTHLY', 'RESEARCH', 'ENGLISH', 'SHORT_COURSE');
CREATE TYPE "IntakeStatus" AS ENUM ('DRAFT', 'UPCOMING', 'OPEN', 'CLOSING_SOON', 'CLOSED', 'FULL', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LateIntakeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Application" ADD COLUMN "intakeId" TEXT;
ALTER TABLE "Application" ADD COLUMN "legacyIntake" TEXT;
UPDATE "Application" SET "legacyIntake" = "intake" WHERE "intake" IS NOT NULL;

CREATE TABLE "Intake" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "campusId" TEXT NOT NULL,
  "campusCode" TEXT,
  "campusName" TEXT,
  "programmeId" TEXT NOT NULL,
  "programmeName" TEXT NOT NULL,
  "studyLevel" TEXT,
  "intakeMonth" INTEGER NOT NULL,
  "intakeYear" INTEGER NOT NULL,
  "intakeDate" TIMESTAMP(3) NOT NULL,
  "applicationOpenDate" TIMESTAMP(3),
  "applicationDeadline" TIMESTAMP(3),
  "lateApplicationDeadline" TIMESTAMP(3),
  "internationalApplicationDeadline" TIMESTAMP(3),
  "arrivalDeadline" TIMESTAMP(3),
  "intakeType" "IntakeType" NOT NULL DEFAULT 'REGULAR',
  "status" "IntakeStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isAvailableForInternationalStudents" BOOLEAN NOT NULL DEFAULT true,
  "maximumSeats" INTEGER,
  "availableSeats" INTEGER,
  "notes" TEXT,
  "parentIntakeId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeSetting" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "minimumInternationalLeadTimeDays" INTEGER NOT NULL DEFAULT 75,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntakeSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntakeAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "intakeId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntakeAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LateIntakeApproval" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "intakeId" TEXT NOT NULL,
  "applicationId" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "status" "LateIntakeApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "internalReason" TEXT NOT NULL,
  "universityAcceptanceConfirmed" BOOLEAN NOT NULL,
  "visaRiskExplained" BOOLEAN NOT NULL,
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LateIntakeApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Intake_tenantId_universityId_campusId_programmeId_intakeMonth_intakeYear_intakeType_key" ON "Intake"("tenantId", "universityId", "campusId", "programmeId", "intakeMonth", "intakeYear", "intakeType");
CREATE INDEX "Intake_tenantId_universityId_campusId_programmeId_idx" ON "Intake"("tenantId", "universityId", "campusId", "programmeId");
CREATE INDEX "Intake_tenantId_status_isActive_idx" ON "Intake"("tenantId", "status", "isActive");
CREATE INDEX "Intake_intakeYear_intakeMonth_idx" ON "Intake"("intakeYear", "intakeMonth");
CREATE INDEX "Intake_parentIntakeId_idx" ON "Intake"("parentIntakeId");
CREATE UNIQUE INDEX "IntakeSetting_tenantId_key" ON "IntakeSetting"("tenantId");
CREATE INDEX "IntakeAuditLog_tenantId_intakeId_createdAt_idx" ON "IntakeAuditLog"("tenantId", "intakeId", "createdAt");
CREATE INDEX "IntakeAuditLog_userId_idx" ON "IntakeAuditLog"("userId");
CREATE INDEX "LateIntakeApproval_tenantId_status_idx" ON "LateIntakeApproval"("tenantId", "status");
CREATE INDEX "LateIntakeApproval_intakeId_idx" ON "LateIntakeApproval"("intakeId");
CREATE INDEX "LateIntakeApproval_applicationId_idx" ON "LateIntakeApproval"("applicationId");
CREATE INDEX "Application_intakeId_idx" ON "Application"("intakeId");

ALTER TABLE "Intake" ADD CONSTRAINT "Intake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_parentIntakeId_fkey" FOREIGN KEY ("parentIntakeId") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntakeSetting" ADD CONSTRAINT "IntakeSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeAuditLog" ADD CONSTRAINT "IntakeAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeAuditLog" ADD CONSTRAINT "IntakeAuditLog_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeAuditLog" ADD CONSTRAINT "IntakeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LateIntakeApproval" ADD CONSTRAINT "LateIntakeApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LateIntakeApproval" ADD CONSTRAINT "LateIntakeApproval_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LateIntakeApproval" ADD CONSTRAINT "LateIntakeApproval_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LateIntakeApproval" ADD CONSTRAINT "LateIntakeApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LateIntakeApproval" ADD CONSTRAINT "LateIntakeApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
