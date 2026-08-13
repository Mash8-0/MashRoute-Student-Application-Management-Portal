const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  EVENT_TYPE, buildSubject, buildSalutation, offerLetterFilename, renderHtml, renderText, validateAttachment,
} = require('../src/services/offerLetterIssuedEmail');
const { resolveRecipients, sanitizeError, isTemporary, sendOfferLetterIssued } = require('../src/services/offerLetterIssuedNotification');
const offerAccess = require('../src/services/offerLetterAccess');

const baseProps = {
  recipientType: 'STUDENT', recipientName: 'Ahmad Rahman', recipientEmail: 'ahmad@example.com',
  studentId: 'MR-1001', studentName: 'Ahmad Rahman', studentGender: 'MALE', passportNumber: 'A12345678',
  programmeName: 'Bachelor of Computer Science (Hons)', campusName: 'Subang Jaya',
  senderName: 'Mash', senderDesignation: 'Tenant Administrator', tenantName: 'Visa Route BD',
  attachmentFileName: 'Offer-Letter-Ahmad-Rahman-A12345678.pdf', attachmentMimeType: 'application/pdf', attachmentSize: 2048,
  attachmentIncluded: true, secureUrl: 'https://mashroute.com/api/v1/offer-letter/view/opaque-high-entropy-token-value-1234567890',
};

test('Offer Letter Issued subject and terminology are exact and safe', () => {
  assert.equal(EVENT_TYPE, 'OFFER_LETTER_ISSUED');
  assert.equal(buildSubject(baseProps), 'Notification: Offer Letter Issued — Ahmad Rahman | A12345678');
  assert.equal(buildSubject({ ...baseProps, passportNumber: null }), 'Notification: Offer Letter Issued — Ahmad Rahman | MR-1001');
  assert.equal(buildSubject({ ...baseProps, studentName: 'Alex\r\nBcc: bad@example.com' }), 'Notification: Offer Letter Issued — Alex Bcc: bad@example.com | A12345678');
  const output = `${renderHtml(baseProps)}\n${renderText(baseProps)}`;
  assert.equal(output.toLowerCase().includes(['offer letter', 'received'].join(' ')), false);
  assert.doesNotMatch(output, /{{[^}]+}}|\bundefined\b|\bnull\b/);
});

test('salutations use stored gender only and bold the complete salutation', () => {
  assert.equal(buildSalutation(baseProps), 'Mr. Ahmad Rahman');
  assert.equal(buildSalutation({ ...baseProps, studentGender: 'FEMALE', recipientName: 'Sarah Islam' }), 'Ms. Sarah Islam');
  assert.equal(buildSalutation({ ...baseProps, studentGender: 'OTHER', recipientName: 'Alex Morgan' }), 'Alex Morgan');
  assert.equal(buildSalutation({ ...baseProps, recipientType: 'AGENT', recipientName: 'Agency One' }), 'Agency One');
  assert.equal(buildSalutation({ ...baseProps, recipientType: 'STAFF', recipientName: 'Sam Staff' }), 'Sam Staff');
  assert.match(renderHtml(baseProps), /Dear <strong[^>]*>Mr\. Ahmad Rahman<\/strong>,/);
});

test('MashRoute responsive HTML includes secure CTA and real dynamic content', () => {
  const html = renderHtml({ ...baseProps, studentName: '<img src=x onerror=alert(1)>' });
  const text = renderText(baseProps);
  assert.match(html, /CONGRATULATIONS!/);
  assert.match(html, /STUDENT DETAILS/);
  assert.match(html, /OPEN OFFER LETTER/);
  assert.match(html, /linear-gradient\(90deg,#10D9F5/);
  assert.match(html, /@media only screen and \(max-width:640px\)/);
  assert.match(html, /max-width:640px/);
  assert.match(html, /alt="Offer Letter Issued"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="https:\/\/mashroute\.com\/api\/v1\/offer-letter\/view\/opaque-high-entropy-token/);
  assert.doesNotMatch(html, /<script|<button|drive\.google|student-1|doc-1/i);
  assert.match(text, /CONGRATULATIONS!/);
  assert.match(text, /https:\/\/mashroute\.com\/api\/v1\/offer-letter\/view\//);
});

test('fallbacks and attachment filename are sanitized', () => {
  const html = renderHtml({ ...baseProps, passportNumber: null, programmeName: null, campusName: undefined, senderDesignation: null, tenantName: null });
  assert.match(html, /MR-1001/);
  assert.equal((html.match(/Not specified/g) || []).length, 2);
  assert.equal(offerLetterFilename({ studentName: '../Ahmad Rahman', passportNumber: 'A/123', studentId: 'x' }), 'Offer-Letter-Ahmad-Rahman-A-123.pdf');
});

test('attachment validation rejects unsafe files and safely omits oversized PDFs', () => {
  const doc = { type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null, mimeType: 'application/pdf' };
  assert.doesNotThrow(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }));
  assert.throws(() => validateAttachment({ ...doc, type: 'PASSPORT' }, { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }), /completed Offer Letter/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'image/png', buffer: Buffer.from('png') }), /must be a PDF/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.alloc(0) }), /file is missing/);
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1); oversized.write('%PDF-');
  assert.equal(validateAttachment(doc, { mimetype: 'application/pdf', buffer: oversized }).attachmentIncluded, false);
  const omittedHtml = renderHtml({ ...baseProps, attachmentIncluded: false });
  assert.match(omittedHtml, /Please view your Offer Letter securely using the button below\./);
  assert.doesNotMatch(omittedHtml, /Please find the attached Offer Letter/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.from('not a pdf') }), /not a valid PDF/);
});

function applicationFixture(settings = {}) {
  return {
    id: 'app-1', tenantId: 'tenant-1', studentId: 'student-1', status: 'OFFER_LETTER_ISSUED', program: 'BSc Computing', campus: 'Subang',
    tenant: { id: 'tenant-1', name: 'Visa Route BD', logo: null, settings, users: [
      { id: 'admin-1', tenantId: 'tenant-1', firstName: 'Tina', lastName: 'Admin', email: 'admin@example.com', role: 'TENANT_ADMIN', isActive: true, deletedAt: null },
    ] },
    student: {
      id: 'student-1', tenantId: 'tenant-1', fullName: 'Ahmad Rahman', passportNumber: 'A12345678', gender: 'MALE', email: 'student@example.com',
      sourceAgent: { id: 'source-agent-1', tenantId: 'tenant-1', displayName: 'Agency One', email: 'agent@example.com', status: 'ACTIVE', linkedUserId: 'registered-agent-1' },
      assignedStaff: { id: 'staff-1', tenantId: 'tenant-1', firstName: 'Sara', lastName: 'Staff', email: 'staff@example.com', role: 'STAFF', isActive: true, deletedAt: null },
    },
    agent: null,
    offerLetterUploadedBy: { id: 'admin-1', tenantId: 'tenant-1', firstName: 'Tina', lastName: 'Admin', email: 'admin@example.com', role: 'TENANT_ADMIN' },
  };
}

test('recipient authorization is tenant-scoped and Agent sharing requires explicit policy', () => {
  const defaults = resolveRecipients(applicationFixture());
  assert.deepEqual(defaults.map((r) => r.type), ['STUDENT', 'STAFF']);
  const enabled = resolveRecipients(applicationFixture({ notifications: { offerLetterIssued: { agent: true, shareDocumentWithAgent: true, tenantAdmin: true } } }));
  assert.deepEqual(enabled.map((r) => r.type), ['STUDENT', 'AGENT', 'STAFF', 'TENANT_ADMIN']);
  const app = applicationFixture({ notifications: { offerLetterIssued: { agent: true, shareDocumentWithAgent: true } } });
  app.student.sourceAgent.tenantId = 'other-tenant';
  app.student.assignedStaff.tenantId = 'other-tenant';
  assert.deepEqual(resolveRecipients(app).map((r) => r.type), ['STUDENT']);
  app.student.sourceAgent.tenantId = 'tenant-1'; app.student.sourceAgent.status = 'INACTIVE';
  assert.deepEqual(resolveRecipients(app).map((r) => r.type), ['STUDENT']);
});

function mockDb(application) {
  const logs = [];
  const audits = [];
  const tokens = [];
  const document = { id: 'doc-1', tenantId: 'tenant-1', studentId: 'student-1', applicationId: 'app-1', type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null, mimeType: 'application/pdf' };
  return {
    logs, audits, tokens,
    application: { findFirst: async ({ where }) => where.tenantId === application.tenantId ? application : null },
    user: { findFirst: async ({ where }) => where.id === 'admin-1' && where.OR?.some((clause) => clause.tenantId === 'tenant-1') ? application.offerLetterUploadedBy : null },
    document: { findFirst: async ({ where }) => Object.entries(where).every(([key, value]) => document[key] === value) ? document : null },
    emailLog: {
      findFirst: async ({ where }) => logs.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) || null,
      create: async ({ data }) => { const row = { ...data }; logs.push(row); return row; },
      update: async ({ where, data }) => {
        const row = logs.find((item) => item.id === where.id);
        for (const [key, value] of Object.entries(data)) row[key] = value?.increment ? (row[key] || 0) + value.increment : value;
        return row;
      },
    },
    activityLog: { create: async ({ data }) => { audits.push(data); return data; } },
    offerLetterAccessToken: {
      create: async ({ data }) => { const row = { id: `token-${tokens.length + 1}`, accessCount: 0, createdAt: new Date(), usedForDocumentVersion: 1, revokedAt: null, ...data }; tokens.push(row); return row; },
      findUnique: async ({ where }) => tokens.find((row) => row.tokenHash === where.tokenHash) || null,
      updateMany: async ({ where, data }) => { for (const row of tokens.filter((item) => item.tenantId === where.tenantId && item.documentId === where.documentId && item.recipientType === where.recipientType && item.recipientRecordId === where.recipientRecordId && !item.revokedAt)) Object.assign(row, data); },
      update: async ({ where, data }) => { const row = tokens.find((item) => item.id === where.id); for (const [key, value] of Object.entries(data)) row[key] = value?.increment ? row[key] + value.increment : value; return row; },
    },
  };
}

test('delivery attaches the PDF, records provider ID, audits Agent sharing, and is idempotent', async () => {
  const application = applicationFixture({ notifications: { offerLetterIssued: { student: false, staff: false, agent: true, shareDocumentWithAgent: true } } });
  const db = mockDb(application);
  const sends = [];
  const input = { applicationId: 'app-1', tenantId: 'tenant-1', documentId: 'doc-1', initiatedByUserId: 'admin-1', file: { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), originalname: 'offer.pdf' } };
  const first = await sendOfferLetterIssued(input, { prisma: db, sendEmail: async (payload) => { sends.push(payload); return { id: 'resend-1' }; } });
  assert.equal(first.eventType, EVENT_TYPE);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].attachments[0].contentType, 'application/pdf');
  assert.match(sends[0].attachments[0].filename, /^Offer-Letter-/);
  assert.equal(db.logs[0].providerMessageId, 'resend-1');
  assert.equal(db.logs[0].status, 'SENT');
  assert.equal(db.logs[0].body.includes('%PDF'), false);
  assert.equal(db.tokens.length, 1);
  assert.match(sends[0].html, /OPEN OFFER LETTER/);
  assert.equal(sends[0].html.includes('doc-1'), false);
  assert.equal(db.audits[0].action, 'OFFER_LETTER_SHARED_BY_EMAIL');
  assert.equal(application.student.sourceAgent.linkedUserId, 'registered-agent-1');
  assert.equal(Object.hasOwn(application.student.sourceAgent, 'portalPermissions'), false);
  const second = await sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => { throw new Error('must not send'); } });
  assert.equal(second.results[0].status, 'SKIPPED');
  assert.equal(sends.length, 1);
});

test('explicit Send Notification creates a new audited delivery attempt', async () => {
  const application = applicationFixture({ notifications: { offerLetterIssued: { student: true, staff: false } } });
  const db = mockDb(application);
  const sends = [];
  const input = { applicationId: 'app-1', tenantId: 'tenant-1', documentId: 'doc-1', initiatedByUserId: 'admin-1', file: { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), originalname: 'offer.pdf' }, forceResend: true };
  const first = await sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => { sends.push('first'); return { id: 'resend-manual-1' }; } });
  const second = await sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => { sends.push('second'); return { id: 'resend-manual-2' }; } });
  assert.equal(first.results[0].status, 'SENT');
  assert.equal(second.results[0].status, 'SENT');
  assert.equal(sends.length, 2);
  assert.equal(db.logs.length, 2);
  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
});

test('secure token validates exact document and rejects expired, revoked, modified, and cross-tenant access', async () => {
  const db = mockDb(applicationFixture());
  const created = await offerAccess.createAccess({ tenantId: 'tenant-1', applicationId: 'app-1', studentId: 'student-1', documentId: 'doc-1', recipientType: 'STUDENT', recipientRecordId: 'student-1', recipientEmail: 'student@example.com', allowDownload: true }, db);
  const raw = decodeURIComponent(created.url.split('/').pop());
  assert.equal((await offerAccess.validateAccess(raw, db)).allowed, true);
  assert.equal((await offerAccess.validateAccess(`${raw}x`, db)).reason, 'INVALID_TOKEN');
  db.tokens[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal((await offerAccess.validateAccess(raw, db)).reason, 'EXPIRED_TOKEN');
  db.tokens[0].expiresAt = new Date(Date.now() + 1000); db.tokens[0].revokedAt = new Date();
  assert.equal((await offerAccess.validateAccess(raw, db)).reason, 'REVOKED_TOKEN');
  db.tokens[0].revokedAt = null; db.tokens[0].tenantId = 'other-tenant';
  assert.equal((await offerAccess.validateAccess(raw, db)).reason, 'DOCUMENT_UNAVAILABLE');
});

test('secure preview security headers and admin preview do not mint live tokens', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../src/modules/applications/offerLetterPublic.controller.js'), 'utf8');
  const notification = fs.readFileSync(path.join(__dirname, '../src/services/offerLetterIssuedNotification.js'), 'utf8');
  assert.match(controller, /Cache-Control.*private, no-store/s);
  assert.match(controller, /X-Robots-Tag.*noindex, nofollow/s);
  const preview = notification.slice(notification.indexOf('async function previewOfferLetterIssued'));
  assert.doesNotMatch(preview, /createAccess\s*\(/);
});

test('cross-tenant/wrong-student document and unauthorized initiator prevent delivery', async () => {
  const app = applicationFixture();
  const db = mockDb(app);
  const file = { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), originalname: 'offer.pdf' };
  await assert.rejects(() => sendOfferLetterIssued({ applicationId: 'app-1', tenantId: 'other', documentId: 'doc-1', initiatedByUserId: 'admin-1', file }, { prisma: db, sendEmail: async () => ({ id: 'x' }) }), /Application not found/);
  await assert.rejects(() => sendOfferLetterIssued({ applicationId: 'app-1', tenantId: 'tenant-1', documentId: 'missing', initiatedByUserId: 'admin-1', file }, { prisma: db, sendEmail: async () => ({ id: 'x' }) }), /completed Offer Letter/);
  await assert.rejects(() => sendOfferLetterIssued({ applicationId: 'app-1', tenantId: 'tenant-1', documentId: 'doc-1', initiatedByUserId: 'staff-1', file }, { prisma: db, sendEmail: async () => ({ id: 'x' }) }), /authorized uploader/);
});

test('temporary failures are sanitized, logged, and safely retryable', async () => {
  const app = applicationFixture({ notifications: { offerLetterIssued: { staff: false } } });
  const db = mockDb(app);
  const input = { applicationId: 'app-1', tenantId: 'tenant-1', documentId: 'doc-1', initiatedByUserId: 'admin-1', file: { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), originalname: 'offer.pdf' } };
  const error = Object.assign(new Error('timeout re_secret\nraw'), { code: 'ETIMEDOUT' });
  await assert.rejects(() => sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => { throw error; } }), /notification email/);
  assert.equal(db.logs[0].status, 'FAILED');
  assert.equal(db.logs[0].safeErrorMessage.includes('re_secret'), false);
  assert.equal(isTemporary(error), true);
  assert.equal(isTemporary(Object.assign(new Error('bad'), { permanent: true })), false);
  assert.deepEqual(sanitizeError(error), { code: 'ETIMEDOUT', message: 'timeout [redacted] raw' });
  await sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => ({ id: 'retry-ok' }) });
  assert.equal(db.logs[0].attemptCount, 2);
  assert.equal(db.logs[0].status, 'SENT');
});

test('Registered Agent remains blocked except for assigned tuition-payment requests', () => {
  for (const route of ['students/student.routes.js', 'documents/document.routes.js']) {
    const source = fs.readFileSync(path.join(__dirname, `../src/modules/${route}`), 'utf8');
    assert.match(source, /router\.use\(authenticate, tenantContext, authorize\('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'\)\)/);
    assert.doesNotMatch(source, /authorize\([^)]*REGISTERED_AGENT/);
  }
  const applicationRoutes = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.routes.js'), 'utf8');
  assert.match(applicationRoutes, /router\.use\(authenticate, tenantContext\)/);
  assert.match(applicationRoutes, /tuition-request', authorize\('STAFF', 'REGISTERED_AGENT'\)/);
  assert.match(applicationRoutes, /router\.use\(authorize\('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'\)\)/);
});

test('upload stores document without sending; protected send is a separate confirmation', () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const uploadStart = serviceSource.indexOf('async uploadOfferLetter');
  const uploadEnd = serviceSource.indexOf('async retryOfferLetterIssuedEmail', uploadStart);
  const uploadFlow = serviceSource.slice(uploadStart, uploadEnd);
  const statusFlow = serviceSource.slice(serviceSource.indexOf('async updateStatus'), uploadStart);
  assert.match(uploadFlow, /prisma\.document\.create/);
  assert.match(uploadFlow, /prisma\.application\.update/);
  assert.doesNotMatch(uploadFlow, /sendOfferLetterIssued\s*\(/);
  assert.doesNotMatch(statusFlow, /sendOfferLetterIssued\s*\(/);
  const routes = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.routes.js'), 'utf8');
  assert.match(routes, /offer-letter-email\/preview.*authorize\('TENANT_ADMIN', 'SUPER_ADMIN', 'STAFF'\)/s);
  assert.match(routes, /offer-letter-email\/retry.*authorize\('TENANT_ADMIN', 'SUPER_ADMIN'\)/s);
});

test('Resend integration keeps credentials server-side and passes verified sender, Reply-To, and attachments', () => {
  const emailSource = fs.readFileSync(path.join(__dirname, '../src/services/emailService.js'), 'utf8');
  assert.match(emailSource, /process\.env\.RESEND_API_KEY/);
  assert.match(emailSource, /process\.env\.MAIL_FROM/);
  assert.match(emailSource, /replyTo/);
  assert.match(emailSource, /attachments/);
  assert.doesNotMatch(emailSource, /VITE_.*RESEND|console\.(?:log|error)\([^)]*RESEND_API_KEY/);
});
