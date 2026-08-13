const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApplicationNotificationTemplate, createTextNotification } = require('../src/services/emailNotify');

const payload = {
  title: 'Application Status Updated',
  message: 'Your application has moved to the next stage.\nYou can review the latest details below.',
  studentName: 'Ahmad Rahman',
  passportNumber: 'A12345678',
  universityName: 'INTI International University',
  programName: 'Bachelor of Computer Science (Hons)',
  status: 'AWAITING_OFFER_LETTER',
  dashboardUrl: 'https://mashroute.com/applications/app-1',
};

test('status email uses the responsive MashRoute design with dynamic details and CTA', () => {
  const html = createApplicationNotificationTemplate(payload);
  assert.match(html, /APPLICATION UPDATE/);
  assert.match(html, /Application Status Updated/);
  assert.match(html, /APPLICATION DETAILS/);
  assert.match(html, /AWAITING OFFER LETTER/);
  assert.match(html, /email-assets\/status-wifi-green\.png/);
  assert.match(html, />LIVE</);
  assert.match(html, /Ahmad Rahman/);
  assert.match(html, /A12345678/);
  assert.match(html, /next stage\.<br>You can review/);
  assert.doesNotMatch(html, /OPEN APPLICATION/);
  assert.match(html, /@media only screen and \(max-width:640px\)/);
  assert.match(html, /linear-gradient\(90deg,#10D9F5/);
  assert.doesNotMatch(html, /undefined|null|<script/i);
});

test('status email escapes dynamic values and keeps a complete plain-text fallback', () => {
  const html = createApplicationNotificationTemplate({ ...payload, studentName: '<img src=x onerror=alert(1)>' });
  const text = createTextNotification(payload);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(text, /Student: Ahmad Rahman/);
  assert.match(text, /Status: AWAITING OFFER LETTER/);
  assert.match(text, /Dashboard: https:\/\/mashroute\.com\/applications\/app-1/);
});

test('payment notifications use the event status instead of stale workflow status', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/emailNotify.js'), 'utf8');
  assert.match(source, /payment_proof_uploaded:[\s\S]*?status: 'PAYMENT PROOF UPLOADED'/);
  assert.match(source, /payment_verified:[\s\S]*?status: 'PAYMENT VERIFIED'/);
  assert.match(source, /extra\.status \|\| def\.status \|\| app\.status/);
});

test('EMGS progress emails are restricted to the requested milestone stages', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const emailedMilestones = [
    [0, 'EMGS Record Created'],
    [35, 'EMGS Approved'],
    [70, 'eVAL Approved'],
    [80, 'Medical Passed'],
    [90, 'Endorsement in Progress'],
    [100, 'Application Successful'],
  ];

  for (const [percentage, milestone] of emailedMilestones) {
    assert.match(source, new RegExp(`${percentage}: '${milestone}'`));
  }
  assert.match(source, /new Set\(\[0, 35, 70, 80, 90, 100\]\)/);
  assert.match(source, /if \(EMGS_EMAIL_MILESTONES\.has\(pct\)\)/);
  assert.match(source, /status: emgsMilestone/);
  assert.match(source, /title: 'EMGS Progress Updated'/);
  assert.match(source, /subject: `MashRoute: EMGS Progress Updated to \$\{pct\}%`/);
});

test('tuition folio generation sends one email with approvals, eVisa, and folio', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  assert.doesNotMatch(source, /emailNotify\.notify\('emgs_approved'/);
  assert.doesNotMatch(source, /emailNotify\.notify\('eval_approved'/);
  const evisaMethod = source.match(/async uploadEvisa[\s\S]*?async uploadEmgsApproval/)?.[0] || '';
  assert.doesNotMatch(evisaMethod, /emailNotify\.notify/);
  assert.match(source, /readWorkflowEmailAttachment\(updated\.evisaUrl, 'eVisa\.pdf'\)/);
  assert.match(source, /readWorkflowEmailAttachment\(updated\.emgsApprovalUrl, 'EMGS Approval\.pdf'\)/);
  assert.match(source, /readWorkflowEmailAttachment\(updated\.evalApprovalUrl, 'eVAL Approval\.pdf'\)/);
  assert.match(source, /readWorkflowEmailAttachment\(invoice\.pdfUrl, 'Tuition Fees Folio\.pdf'\)/);
  assert.match(source, /emailNotify\.notify\('evisa_approved', updated, \{/);
  assert.match(source, /attachments \}\);/);
  assert.match(source, /EVISA_ATTACHMENTS_TOTAL_MAX_BYTES/);
});

test('tuition workflow supports staff request and admin-only folio generation', () => {
  const service = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.routes.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/shared/ApplicationDetail.jsx'), 'utf8');
  const studentUi = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/shared/StudentDetail.jsx'), 'utf8');
  const modal = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/payments/TuitionPaymentSetupModal.jsx'), 'utf8');
  assert.match(service, /async requestTuitionPayment/);
  assert.match(service, /async openTuitionPayment/);
  assert.match(service, /Only admins can open tuition payment and generate the folio/);
  assert.match(service, /generateInvoicePdf/);
  assert.match(service, /uploads\/temp/);
  assert.match(routes, /open-tuition-payment', authorize\('TENANT_ADMIN', 'SUPER_ADMIN'\)/);
  assert.match(routes, /tuition-request', authorize\('STAFF', 'REGISTERED_AGENT'\)/);
  assert.match(service, /application\.agentId !== userId/);
  assert.match(ui, /Request Tuition Payment/);
  assert.match(ui, /tab=payment&tuitionApp=/);
  assert.doesNotMatch(ui, /window\.prompt\('Tuition fee amount/);
  assert.match(studentUi, /TuitionPaymentSetupModal/);
  assert.match(modal, /Open Tuition Fees Payment & Generate Tuition Fees Folio/);
  assert.match(modal, /applicationAPI\.openTuitionPayment/);
  assert.match(modal, /Select Payment Account/);
  assert.match(modal, /Tenant \/ Admin Account/);
  assert.match(service, /paymentDestinationAccount\.findFirst/);
  assert.match(service, /paymentAccountSnapshot/);
  assert.match(ui, /\|\| !!app\.evisaUrl \|\|/);
});

test('admins can delete EMGS approval, eVAL approval, and eVisa workflow files', () => {
  const backendSource = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const frontendSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/shared/StudentDetail.jsx'), 'utf8');
  for (const kind of ['emgs-approval', 'eval-approval', 'evisa']) {
    assert.match(backendSource, new RegExp(`['"]?${kind}['"]?: \\{`));
    assert.match(frontendSource, new RegExp(`['"]${kind}['"]`));
  }
  assert.match(backendSource, /postEvalStatus: 'AWAITING_EVISA'/);
  assert.match(backendSource, /_deleteStoredWorkflowFile\(fileUrl\)/);
});
