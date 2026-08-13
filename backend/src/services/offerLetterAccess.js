const { createHash, randomBytes, timingSafeEqual } = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const prisma = require('../config/database');

const ACTION = 'VIEW_OFFER_LETTER';
const TOKEN_VERSION = 1;

function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function accessBaseUrl() {
  const value = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://mashroute.com').replace(/\/$/, '');
  return /^https:\/\//i.test(value) || process.env.NODE_ENV !== 'production' ? value : 'https://mashroute.com';
}

function ttlHours(recipientType) {
  const configured = Number(recipientType === 'STUDENT' ? process.env.OFFER_LETTER_STUDENT_LINK_HOURS : process.env.OFFER_LETTER_INTERNAL_LINK_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : (recipientType === 'STUDENT' ? 168 : 24);
}

async function createAccess({ tenantId, applicationId, studentId, documentId, recipientType, recipientRecordId, recipientEmail, allowDownload, emailLogId }, db = prisma) {
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours(recipientType) * 60 * 60 * 1000);
  await db.offerLetterAccessToken.create({ data: {
    tokenHash: tokenHash(raw), tokenVersion: TOKEN_VERSION, tenantId, applicationId, studentId, documentId,
    recipientType, recipientRecordId, recipientEmail: recipientEmail.toLowerCase(), action: ACTION,
    expiresAt, allowDownload: Boolean(allowDownload), emailLogId,
  } });
  return { url: `${accessBaseUrl()}/api/v1/offer-letter/view/${encodeURIComponent(raw)}`, expiresAt };
}

async function revokeForRecipient({ tenantId, documentId, recipientType, recipientRecordId }, db = prisma) {
  await db.offerLetterAccessToken.updateMany({
    where: { tenantId, documentId, recipientType, recipientRecordId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function validateAccess(rawToken, db = prisma) {
  if (!rawToken || String(rawToken).length < 40) return { allowed: false, reason: 'INVALID_TOKEN' };
  const digest = tokenHash(rawToken);
  const record = await db.offerLetterAccessToken.findUnique({ where: { tokenHash: digest } });
  if (!record || !timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(digest))) return { allowed: false, reason: 'INVALID_TOKEN' };
  if (record.revokedAt) return { allowed: false, reason: 'REVOKED_TOKEN', record };
  if (record.usedForDocumentVersion !== TOKEN_VERSION || record.tokenVersion !== TOKEN_VERSION) return { allowed: false, reason: 'INVALID_VERSION', record };
  if (record.expiresAt <= new Date()) return { allowed: false, reason: 'EXPIRED_TOKEN', record };
  if (record.action !== ACTION) return { allowed: false, reason: 'INVALID_ACTION', record };
  const document = await db.document.findFirst({ where: {
    id: record.documentId, tenantId: record.tenantId, studentId: record.studentId,
    applicationId: record.applicationId, type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null,
  } });
  if (!document) return { allowed: false, reason: 'DOCUMENT_UNAVAILABLE', record };
  return { allowed: true, record, document };
}

async function auditAccess(result, req, db = prisma) {
  const record = result.record;
  await db.activityLog.create({ data: {
    tenantId: record?.tenantId || null, userId: null,
    action: result.allowed ? 'OFFER_LETTER_LINK_OPENED' : 'OFFER_LETTER_LINK_DENIED',
    entity: 'Document', entityId: record?.documentId || null,
    ipAddress: req?.ip || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 300) || null,
    newValue: { allowed: result.allowed, reason: result.reason || null, recipientType: record?.recipientType || null },
  } });
  if (result.allowed) await db.offerLetterAccessToken.update({ where: { id: record.id }, data: { openedAt: new Date(), lastAccessedAt: new Date(), accessCount: { increment: 1 } } });
}

async function readDocument(document) {
  if (document.fileSource !== 'google_drive' && !/^https?:\/\//i.test(document.fileUrl || '')) {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const candidate = path.resolve(process.cwd(), String(document.fileUrl || '').replace(/^\/+/, ''));
    if (!candidate.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error('Document storage path is not permitted');
    return fs.readFile(candidate);
  }
  const url = new URL(document.fileUrl);
  const hosts = ['drive.google.com', 'www.googleapis.com', 'lh3.googleusercontent.com', 'mashroute.com', 'www.mashroute.com', ...String(process.env.OFFER_LETTER_STORAGE_HOSTS || '').split(',').map((v) => v.trim()).filter(Boolean)];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) throw new Error('Document storage host is not permitted');
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error('Document could not be loaded');
  const buffer = Buffer.from(await response.arrayBuffer());
  const max = Number(process.env.OFFER_LETTER_PREVIEW_MAX_BYTES) || 20 * 1024 * 1024;
  if (buffer.length > max) throw new Error('Document exceeds preview size limit');
  return buffer;
}

module.exports = { ACTION, TOKEN_VERSION, tokenHash, ttlHours, createAccess, revokeForRecipient, validateAccess, auditAccess, readDocument };
