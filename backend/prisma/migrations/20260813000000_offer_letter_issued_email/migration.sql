CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sentByUserId" TEXT,
  "sentByName" TEXT,
  "emailType" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "toEmailHidden" TEXT,
  "toUniversityId" TEXT,
  "attachmentNames" JSONB,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "errorMessage" TEXT,
  "providerResponse" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attachmentDocumentIds" JSONB,
  "notificationType" TEXT,
  "recipientEmail" TEXT,
  "recipientType" TEXT,
  "safeErrorMessage" TEXT,
  "fallbackUsed" BOOLEAN DEFAULT false,
  "fromEmail" TEXT,
  "replyToEmail" TEXT,
  "senderSource" TEXT,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "EmailLog"
  ADD COLUMN IF NOT EXISTS "offerLetterDocumentId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientRecordId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'RESEND',
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "EmailLog_offerLetterDocumentId_idx" ON "EmailLog"("offerLetterDocumentId");
CREATE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_idx" ON "EmailLog"("idempotencyKey");

ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "attachmentIncluded" BOOLEAN;
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "tokenCreatedAt" TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OfferLetterAccessToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL DEFAULT 1,
  "usedForDocumentVersion" INTEGER NOT NULL DEFAULT 1,
  "tenantId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "recipientRecordId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "allowDownload" BOOLEAN NOT NULL DEFAULT false,
  "emailLogId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferLetterAccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfferLetterAccessToken_tokenHash_key" ON "OfferLetterAccessToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "OfferLetterAccessToken_tenantId_documentId_idx" ON "OfferLetterAccessToken"("tenantId", "documentId");
CREATE INDEX IF NOT EXISTS "OfferLetterAccessToken_applicationId_idx" ON "OfferLetterAccessToken"("applicationId");
CREATE INDEX IF NOT EXISTS "OfferLetterAccessToken_recipientType_recipientRecordId_idx" ON "OfferLetterAccessToken"("recipientType", "recipientRecordId");
CREATE INDEX IF NOT EXISTS "OfferLetterAccessToken_expiresAt_idx" ON "OfferLetterAccessToken"("expiresAt");
CREATE INDEX IF NOT EXISTS "EmailLog_applicationId_idx" ON "EmailLog"("applicationId");
CREATE INDEX IF NOT EXISTS "EmailLog_emailType_idx" ON "EmailLog"("emailType");
CREATE INDEX IF NOT EXISTS "EmailLog_notificationType_idx" ON "EmailLog"("notificationType");
CREATE INDEX IF NOT EXISTS "EmailLog_recipientType_idx" ON "EmailLog"("recipientType");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_tenantId_idx" ON "EmailLog"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "email_log_offer_letter_recipient_unique"
  ON "EmailLog"("idempotencyKey", "recipientType", "recipientRecordId");
