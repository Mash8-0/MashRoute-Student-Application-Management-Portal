const { randomUUID } = require('crypto');
const prisma = require('../config/database');
const { isValidEmail, sendNotificationEmail } = require('./emailService');
const {
  EVENT_TYPE, buildSubject, offerLetterFilename, renderHtml, renderText, validateAttachment,
} = require('./offerLetterIssuedEmail');
const offerAccess = require('./offerLetterAccess');

const TEMPORARY_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'RATE_LIMITED']);

function notificationPolicy(settings) {
  const policy = settings?.notifications?.offerLetterIssued || settings?.offerLetterIssuedNotifications || {};
  return {
    student: policy.student !== false,
    staff: policy.staff !== false,
    agent: policy.agent === true && policy.shareDocumentWithAgent === true,
    tenantAdmin: policy.tenantAdmin === true,
  };
}

function userName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || null;
}

function sanitizeError(error) {
  const message = String(error?.message || 'Email delivery failed')
    .replace(/re_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
  return { code: String(error?.code || error?.name || 'DELIVERY_FAILED').slice(0, 80), message };
}

function isTemporary(error) {
  const status = Number(error?.statusCode || error?.status);
  return error?.permanent !== true && (TEMPORARY_CODES.has(error?.code) || status === 429 || status >= 500);
}

function resolveRecipients(application) {
  const policy = notificationPolicy(application.tenant?.settings);
  const recipients = [];
  const add = (recipient) => {
    if (!recipient?.recordId || !isValidEmail(recipient.email)) return;
    if (recipient.tenantId !== application.tenantId) return;
    if (recipients.some((row) => row.email.toLowerCase() === recipient.email.toLowerCase())) return;
    recipients.push(recipient);
  };

  if (policy.student) add({
    type: 'STUDENT', recordId: application.student.id, tenantId: application.student.tenantId,
    name: application.student.fullName, email: application.student.email,
  });

  const sourceAgent = application.student.sourceAgent;
  if (policy.agent && sourceAgent?.status === 'ACTIVE' && sourceAgent.tenantId === application.tenantId) {
    add({ type: 'AGENT', recordId: sourceAgent.id, tenantId: sourceAgent.tenantId, name: sourceAgent.displayName, email: sourceAgent.email });
  }

  if (policy.staff) {
    for (const staff of [application.student.assignedStaff, application.agent]) {
      if (staff?.isActive && !staff.deletedAt && staff.role === 'STAFF') {
        add({ type: 'STAFF', recordId: staff.id, tenantId: staff.tenantId, name: userName(staff), email: staff.email });
      }
    }
  }

  if (policy.tenantAdmin) {
    for (const admin of application.tenant.users || []) {
      if (admin.isActive && !admin.deletedAt && admin.role === 'TENANT_ADMIN') {
        add({ type: 'TENANT_ADMIN', recordId: admin.id, tenantId: admin.tenantId, name: userName(admin), email: admin.email });
      }
    }
  }
  return recipients;
}

async function loadContext(applicationId, tenantId, db = prisma) {
  return db.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: {
      tenant: { select: { id: true, name: true, logo: true, settings: true, users: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, role: true, isActive: true, deletedAt: true } } } },
      student: {
        include: {
          sourceAgent: { select: { id: true, tenantId: true, displayName: true, email: true, status: true, linkedUserId: true } },
          assignedStaff: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, role: true, isActive: true, deletedAt: true } },
        },
      },
      agent: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, role: true, isActive: true, deletedAt: true } },
      offerLetterUploadedBy: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });
}

async function prepareLog(db, data) {
  const uniqueWhere = {
    idempotencyKey: data.idempotencyKey,
    recipientType: data.recipientType,
    recipientRecordId: data.recipientRecordId,
  };
  const existing = await db.emailLog.findFirst({ where: uniqueWhere });
  if (existing?.status === 'SENT') return { log: existing, skip: true };
  if (existing) {
    return {
      log: await db.emailLog.update({
        where: { id: existing.id },
        data: { status: 'RETRYING', attemptCount: { increment: 1 }, errorMessage: null, safeErrorMessage: null, failureCode: null },
      }),
      skip: false,
    };
  }
  try {
    return {
      log: await db.emailLog.create({ data: { id: randomUUID(), ...data, status: 'SENDING', attemptCount: 1 } }),
      skip: false,
    };
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const raced = await db.emailLog.findFirst({ where: uniqueWhere });
    return { log: raced, skip: raced?.status === 'SENT' || raced?.status === 'SENDING' };
  }
}

async function sendOfferLetterIssued({ applicationId, tenantId, documentId, initiatedByUserId, file, forceResend = false }, deps = {}) {
  const db = deps.prisma || prisma;
  const sendEmail = deps.sendEmail || sendNotificationEmail;
  const application = await loadContext(applicationId, tenantId, db);
  if (!application) throw Object.assign(new Error('Application not found for this tenant'), { statusCode: 404, code: 'APPLICATION_NOT_FOUND', permanent: true });
  if (application.status !== 'OFFER_LETTER_ISSUED') throw Object.assign(new Error('Application must be at Offer Letter Issued'), { statusCode: 400, code: 'INVALID_STATUS', permanent: true });

  const document = await db.document.findFirst({ where: { id: documentId, tenantId, studentId: application.studentId, applicationId } });
  const attachmentDecision = validateAttachment(document, file);

  const initiator = await db.user.findFirst({
    where: { id: initiatedByUserId, role: { in: ['TENANT_ADMIN', 'SUPER_ADMIN'] }, isActive: true, deletedAt: null, OR: [{ tenantId }, { role: 'SUPER_ADMIN' }] },
    select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!initiator) {
    throw Object.assign(new Error('Only the authorized uploader can initiate this notification'), { statusCode: 403, code: 'UNAUTHORIZED_INITIATOR', permanent: true });
  }

  const recipients = resolveRecipients(application);
  if (!recipients.length) throw Object.assign(new Error('No authorized recipients have a valid email address'), { statusCode: 422, code: 'NO_RECIPIENTS', permanent: true });

  const identifier = application.student.passportNumber || application.student.id;
  const attachmentFileName = offerLetterFilename({ studentName: application.student.fullName, passportNumber: identifier, studentId: application.student.id });
  const baseIdempotencyKey = `offer-letter-issued:${tenantId}:${application.studentId}:${document.id}`;
  // An explicit, permission-protected Send Notification click is a deliberate
  // new delivery. Other callers retain deterministic duplicate protection.
  const idempotencyKey = forceResend ? `${baseIdempotencyKey}:manual:${randomUUID()}` : baseIdempotencyKey;
  const senderName = userName(initiator) || application.tenant.name || 'MashRoute';
  const senderDesignation = initiator.role === 'TENANT_ADMIN' ? 'Tenant Administrator' : 'Administrator';
  const results = [];

  for (const recipient of recipients) {
    const props = {
      recipientType: recipient.type, recipientName: recipient.name, recipientEmail: recipient.email,
      studentId: application.student.id, studentName: application.student.fullName, studentGender: application.student.gender,
      passportNumber: application.student.passportNumber, programmeName: application.program, campusName: application.campus,
      senderName, senderDesignation, tenantName: application.tenant.name, logoUrl: application.tenant.logo,
      attachmentFileName, attachmentMimeType: 'application/pdf', attachmentSize: file.buffer.length,
      attachmentIncluded: attachmentDecision.attachmentIncluded,
    };
    const subject = buildSubject(props);
    const logData = {
      applicationId, tenantId, sentByUserId: initiatedByUserId, sentByName: senderName,
      emailType: EVENT_TYPE, notificationType: EVENT_TYPE, subject, body: renderText(props),
      toEmailHidden: recipient.email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2'), recipientEmail: recipient.email,
      recipientType: recipient.type, recipientRecordId: recipient.recordId, offerLetterDocumentId: document.id,
      attachmentNames: attachmentDecision.attachmentIncluded ? [attachmentFileName] : [], attachmentDocumentIds: [document.id], provider: 'RESEND',
      initiatedByUserId, idempotencyKey, fromEmail: process.env.MAIL_FROM || null,
      replyToEmail: isValidEmail(initiator.email) ? initiator.email : null, senderSource: initiator.role,
    };
    const prepared = await prepareLog(db, logData);
    if (prepared.skip) { results.push({ recipientType: recipient.type, status: 'SKIPPED', logId: prepared.log?.id }); continue; }

    try {
      await offerAccess.revokeForRecipient({ tenantId, documentId: document.id, recipientType: recipient.type, recipientRecordId: recipient.recordId }, db);
      const secure = await offerAccess.createAccess({
        tenantId, applicationId, studentId: application.studentId, documentId: document.id,
        recipientType: recipient.type, recipientRecordId: recipient.recordId, recipientEmail: recipient.email,
        allowDownload: recipient.type !== 'AGENT', emailLogId: prepared.log.id,
      }, db);
      props.secureUrl = secure.url;
      const provider = await sendEmail({
        to: recipient.email, subject, html: renderHtml(props), text: renderText(props),
        replyTo: isValidEmail(initiator.email) ? initiator.email : undefined,
        attachments: attachmentDecision.attachmentIncluded ? [{ filename: attachmentFileName, content: file.buffer, contentType: 'application/pdf' }] : [],
      });
      await db.emailLog.update({ where: { id: prepared.log.id }, data: { status: 'SENT', sentAt: new Date(), providerMessageId: provider?.id || null, providerResponse: provider?.id ? { id: provider.id } : null, tokenCreatedAt: new Date(), tokenExpiresAt: secure.expiresAt, attachmentIncluded: attachmentDecision.attachmentIncluded } });
      if (recipient.type === 'AGENT') {
        await db.activityLog.create({ data: { tenantId, userId: initiatedByUserId, action: 'OFFER_LETTER_SHARED_BY_EMAIL', entity: 'Document', entityId: document.id, newValue: { recipientType: 'AGENT', recipientRecordId: recipient.recordId, emailLogId: prepared.log.id, idempotencyKey } } });
      }
      results.push({ recipientType: recipient.type, status: 'SENT', logId: prepared.log.id, providerMessageId: provider?.id || null });
    } catch (error) {
      await offerAccess.revokeForRecipient({ tenantId, documentId: document.id, recipientType: recipient.type, recipientRecordId: recipient.recordId }, db).catch(() => {});
      const safe = sanitizeError(error);
      await db.emailLog.update({ where: { id: prepared.log.id }, data: { status: 'FAILED', failureCode: safe.code, safeErrorMessage: safe.message, errorMessage: safe.message } });
      results.push({ recipientType: recipient.type, status: 'FAILED', logId: prepared.log.id, temporary: isTemporary(error), error: safe.message });
    }
  }

  const failures = results.filter((result) => result.status === 'FAILED');
  if (failures.length) {
    const error = new Error(`Offer Letter uploaded, but ${failures.length} notification email(s) failed. Retry the notification safely.`);
    error.statusCode = 502;
    error.code = 'OFFER_LETTER_EMAIL_FAILED';
    error.results = results;
    throw error;
  }
  return { eventType: EVENT_TYPE, idempotencyKey, results };
}

async function previewOfferLetterIssued({ applicationId, tenantId, recipientType }, deps = {}) {
  const db = deps.prisma || prisma;
  const application = await loadContext(applicationId, tenantId, db);
  if (!application) throw Object.assign(new Error('Application not found for this tenant'), { statusCode: 404 });
  const document = await db.document.findFirst({ where: { tenantId, applicationId, studentId: application.studentId, type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!document) throw Object.assign(new Error('A completed Offer Letter upload is required'), { statusCode: 400 });
  const recipients = resolveRecipients(application);
  const recipient = recipients.find((item) => item.type === recipientType) || recipients[0];
  if (!recipient) throw Object.assign(new Error('No authorized recipient is available'), { statusCode: 422 });
  const max = Number(process.env.OFFER_LETTER_EMAIL_MAX_BYTES) || 10 * 1024 * 1024;
  const attachmentIncluded = Number(document.fileSize || 0) <= max;
  const props = {
    recipientType: recipient.type, recipientName: recipient.name, recipientEmail: recipient.email,
    studentId: application.student.id, studentName: application.student.fullName, studentGender: application.student.gender,
    passportNumber: application.student.passportNumber, programmeName: application.program, campusName: application.campus,
    tenantName: application.tenant.name, logoUrl: application.tenant.logo, attachmentIncluded,
    attachmentFileName: offerLetterFilename({ studentName: application.student.fullName, passportNumber: application.student.passportNumber, studentId: application.student.id }),
    secureUrl: `${(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://mashroute.com').replace(/\/$/, '')}/offer-letter/preview-not-redeemable`,
  };
  return { subject: buildSubject(props), recipient: { type: recipient.type, email: recipient.email }, attachmentIncluded, html: renderHtml(props), text: renderText(props) };
}

module.exports = { notificationPolicy, resolveRecipients, sanitizeError, isTemporary, sendOfferLetterIssued, previewOfferLetterIssued, loadContext };
