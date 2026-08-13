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
