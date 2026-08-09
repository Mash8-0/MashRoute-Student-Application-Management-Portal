-- MDAC reminder and tracking workflow.
-- Safe for existing rows: all new business fields are nullable or have defaults.

CREATE TYPE "MdacStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'SUBMITTED', 'VERIFIED', 'NEEDS_REVIEW');

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MDAC_CONFIRMATION';

ALTER TABLE "Application"
  ADD COLUMN "arrivalTimezone" TEXT DEFAULT 'Asia/Kuala_Lumpur',
  ADD COLUMN "flightNumber" TEXT,
  ADD COLUMN "airline" TEXT,
  ADD COLUMN "lastPortOfEmbarkation" TEXT,
  ADD COLUMN "modeOfTravel" TEXT,
  ADD COLUMN "malaysiaAccommodationName" TEXT,
  ADD COLUMN "malaysiaAccommodationType" TEXT,
  ADD COLUMN "malaysiaAccommodationAddress" TEXT,
  ADD COLUMN "malaysiaAccommodationState" TEXT,
  ADD COLUMN "malaysiaAccommodationCity" TEXT,
  ADD COLUMN "malaysiaAccommodationPostcode" TEXT,
  ADD COLUMN "mdacRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mdacStatus" "MdacStatus" NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN "mdacSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "mdacProofUrl" TEXT,
  ADD COLUMN "mdacProofDocumentId" TEXT,
  ADD COLUMN "mdacVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mdacVerifiedById" TEXT,
  ADD COLUMN "mdacReviewNotes" TEXT,
  ADD COLUMN "mdacPreviousArrivalDate" TIMESTAMP(3);

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_mdacVerifiedById_fkey"
  FOREIGN KEY ("mdacVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Application_tenantId_arrivalDate_idx" ON "Application"("tenantId", "arrivalDate");
CREATE INDEX "Application_tenantId_mdacStatus_idx" ON "Application"("tenantId", "mdacStatus");
CREATE INDEX "Application_tenantId_mdacRequired_idx" ON "Application"("tenantId", "mdacRequired");
CREATE INDEX "Application_tenantId_mdacStatus_arrivalDate_idx" ON "Application"("tenantId", "mdacStatus", "arrivalDate");
CREATE INDEX "Application_mdacVerifiedById_idx" ON "Application"("mdacVerifiedById");
