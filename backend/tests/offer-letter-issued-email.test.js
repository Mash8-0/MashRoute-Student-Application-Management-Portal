const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  EVENT_TYPE, buildSubject, buildSalutation, offerLetterFilename, renderHtml, renderText, validateAttachment,
} = require('../src/services/offerLetterIssuedEmail');
const { resolveRecipients, sanitizeError, isTemporary, sendOfferLetterIssued } = require('../src/services/offerLetterIssuedNotification');

const baseProps = {
  recipientType: 'STUDENT', recipientName: 'Ahmad Rahman', recipientEmail: 'ahmad@example.com',
  studentId: 'MR-1001', studentName: 'Ahmad Rahman', studentGender: 'MALE', passportNumber: 'A12345678',
  programmeName: 'Bachelor of Computer Science (Hons)', campusName: 'Subang Jaya',
  senderName: 'Mash', senderDesignation: 'Tenant Administrator', tenantName: 'Visa Route BD',
  attachmentFileName: 'Offer-Letter-Ahmad-Rahman-A12345678.pdf', attachmentMimeType: 'application/pdf', attachmentSize: 2048,
};

test('Offer Letter Issued subject and terminology are exact and safe', () => {
  assert.equal(EVENT_TYPE, 'OFFER_LETTER_ISSUED');
  assert.equal(buildSubject(baseProps), 'Notification: Offer Letter Issued — Ahmad Rahman | A12345678');
  assert.equal(buildSubject({ ...baseProps, passportNumber: null }), 'Notification: Offer Letter Issued — Ahmad Rahman | MR-1001');
  assert.equal(buildSubject({ ...baseProps, studentName: 'Alex\r\nBcc: bad@example.com' }), 'Notification: Offer Letter Issued — Alex Bcc: bad@example.com | A12345678');
  const output = `${renderHtml(baseProps)}\n${renderText(baseProps)}`;
  assert.equal(output.toLowerCase().includes(['offer letter', 'received'].join(' ')), false);
  assert.doesNotMatch(output, /{{|}}|undefined|null/);
});

test('salutations use stored gender only and bold the complete salutation', () => {
  assert.equal(buildSalutation(baseProps), 'Mr. Ahmad Rahman');
  assert.equal(buildSalutation({ ...baseProps, studentGender: 'FEMALE', recipientName: 'Sarah Islam' }), 'Ms. Sarah Islam');
  assert.equal(buildSalutation({ ...baseProps, studentGender: 'OTHER', recipientName: 'Alex Morgan' }), 'Alex Morgan');
  assert.equal(buildSalutation({ ...baseProps, recipientType: 'AGENT', recipientName: 'Agency One' }), 'Agency One');
  assert.equal(buildSalutation({ ...baseProps, recipientType: 'STAFF', recipientName: 'Sam Staff' }), 'Sam Staff');
  assert.match(renderHtml(baseProps), /<strong[^>]*>Dear Mr\. Ahmad Rahman,<\/strong>/);
});

test('approved HTML and plain text render without links, buttons, scripts, or public document URLs', () => {
  const html = renderHtml({ ...baseProps, studentName: '<img src=x onerror=alert(1)>' });
  const text = renderText(baseProps);
  assert.match(html, /<strong[^>]*>Congratulations!<\/strong>/);
  assert.match(html, /Student Details/);
  assert.match(html, /Please find the attached Offer Letter for your reference\.<\/div>/);
  assert.match(html, /Attached Offer Letter/);
  assert.match(html, /max-width:620px/);
  assert.match(html, /alt="MashRoute"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script|<button|>Open<|>View<|>Download<|offerLetterUrl|drive\.google/i);
  assert.doesNotMatch(html, /<a\b/i);
  assert.match(text, /Congratulations! We are pleased/);
  assert.match(text, /The official Offer Letter is also attached to this email\./);
});

test('fallbacks and attachment filename are sanitized', () => {
  const html = renderHtml({ ...baseProps, passportNumber: null, programmeName: null, campusName: undefined, senderDesignation: null, tenantName: null });
  assert.match(html, /MR-1001/);
  assert.equal((html.match(/Not specified/g) || []).length, 2);
  assert.equal(offerLetterFilename({ studentName: '../Ahmad Rahman', passportNumber: 'A/123', studentId: 'x' }), 'Offer-Letter-Ahmad-Rahman-A-123.pdf');
});

test('attachment validation rejects wrong, missing, inactive, and oversized files', () => {
  const doc = { type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null, mimeType: 'application/pdf' };
  assert.doesNotThrow(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }));
  assert.throws(() => validateAttachment({ ...doc, type: 'PASSPORT' }, { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }), /completed Offer Letter/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'image/png', buffer: Buffer.from('png') }), /must be a PDF/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.alloc(0) }), /file is missing/);
  assert.throws(() => validateAttachment(doc, { mimetype: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }), /size limit/);
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
  const document = { id: 'doc-1', tenantId: 'tenant-1', studentId: 'student-1', applicationId: 'app-1', type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null, mimeType: 'application/pdf' };
  return {
    logs, audits,
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
  assert.equal(db.audits[0].action, 'OFFER_LETTER_SHARED_BY_EMAIL');
  assert.equal(application.student.sourceAgent.linkedUserId, 'registered-agent-1');
  assert.equal(Object.hasOwn(application.student.sourceAgent, 'portalPermissions'), false);
  const second = await sendOfferLetterIssued(input, { prisma: db, sendEmail: async () => { throw new Error('must not send'); } });
  assert.equal(second.results[0].status, 'SKIPPED');
  assert.equal(sends.length, 1);
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

test('Registered Agent remains blocked from Student, Application, and Document APIs', () => {
  for (const route of ['students/student.routes.js', 'applications/application.routes.js', 'documents/document.routes.js']) {
    const source = fs.readFileSync(path.join(__dirname, `../src/modules/${route}`), 'utf8');
    assert.match(source, /router\.use\(authenticate, tenantContext, authorize\('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'\)\)/);
    assert.doesNotMatch(source, /authorize\([^)]*REGISTERED_AGENT/);
  }
});

test('canonical workflow trigger runs after document upload and status-stage email is suppressed', () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const uploadStart = serviceSource.indexOf('async uploadOfferLetter');
  const uploadEnd = serviceSource.indexOf('async retryOfferLetterIssuedEmail', uploadStart);
  const uploadFlow = serviceSource.slice(uploadStart, uploadEnd);
  const statusFlow = serviceSource.slice(serviceSource.indexOf('async updateStatus'), uploadStart);
  assert.ok(uploadFlow.indexOf('prisma.document.create') < uploadFlow.indexOf('sendOfferLetterIssued'));
  assert.ok(uploadFlow.indexOf('prisma.application.update') < uploadFlow.indexOf('sendOfferLetterIssued'));
  assert.doesNotMatch(statusFlow, /sendOfferLetterIssued\s*\(/);
  assert.equal((uploadFlow.match(/sendOfferLetterIssued/g) || []).length, 1);
});

test('Resend integration keeps credentials server-side and passes verified sender, Reply-To, and attachments', () => {
  const emailSource = fs.readFileSync(path.join(__dirname, '../src/services/emailService.js'), 'utf8');
  assert.match(emailSource, /process\.env\.RESEND_API_KEY/);
  assert.match(emailSource, /process\.env\.MAIL_FROM/);
  assert.match(emailSource, /replyTo/);
  assert.match(emailSource, /attachments/);
  assert.doesNotMatch(emailSource, /VITE_.*RESEND|console\.(?:log|error)\([^)]*RESEND_API_KEY/);
});
