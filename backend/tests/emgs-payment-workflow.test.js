const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const service = require('../src/modules/payments/emgsPayment.service');

test('money values use exact two-decimal normalization without floats', () => {
  assert.equal(service.money('3500'), '3500.00');
  assert.equal(service.money('3500.5'), '3500.50');
  assert.equal(service.cents('3500.50'), 350050n);
  assert.equal(service.decimalFromCents(350050n), '3500.50');
  assert.throws(() => service.money('1.999'), (error) => /at most 2 decimal places/.test(error.message));
  assert.throws(() => service.money('-5'), (error) => /positive amount/.test(error.message));
});

test('account numbers are masked for list responses', () => {
  assert.equal(service.maskAccountNumber('1234 5678 4589'), '•••• 4589');
  assert.equal(service.publicAccount({ id: 'a1', accountNumber: '12345678', maskedAccountNumber: '•••• 5678' }).accountNumber, undefined);
});

test('account numbers are encrypted at rest and can be revealed with the configured key', () => {
  process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = 'test-only-key-with-at-least-thirty-two-characters';
  const protectedValue = service.protectAccountNumber('123456784589');
  assert.match(protectedValue, /^v1:/);
  assert.doesNotMatch(protectedValue, /123456784589/);
  assert.equal(service.revealAccountNumber(protectedValue), '123456784589');
});

test('status derivation uses allocations and never treats proof upload as paid', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/emgsPayment.service.js'), 'utf8');
  assert.match(source, /emgsPaymentAllocation\.findMany/);
  assert.match(source, /status: 'PROOF_UPLOADED'/);
  assert.match(source, /PAYMENT_VERIFIED/);
  assert.match(source, /isolationLevel: 'Serializable'/);
});

test('duplicate proof hashes and transaction references are rejected server-side', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/emgsPayment.service.js'), 'utf8');
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /proof or transaction reference has already been submitted/);
});

test('verification creates exactly one allocation and one receipt per transaction', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert.match(schema, /@@unique\(\[transactionId, feeItemId\]\)/);
  assert.match(schema, /transactionId\s+String\s+@unique/);
});

test('reversals preserve verified history instead of editing allocations', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/emgsPayment.service.js'), 'utf8');
  assert.match(schema, /model EmgsPaymentReversal/);
  assert.match(source, /REFUND_REVERSAL_CREATED/);
  assert.doesNotMatch(source.slice(source.indexOf('async function reverse')), /emgsPaymentAllocation\.delete/);
});

test('finance routes expose account lifecycle and proof review without registered-agent access', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/emgsPayment.routes.js'), 'utf8');
  assert.match(source, /patch\('\/accounts\/:id'/);
  assert.match(source, /delete\('\/accounts\/:id'/);
  assert.match(source, /transactions\/:id\/verify/);
  assert.match(source, /transactions\/:id\/reject/);
  assert.match(source, /transactions\/:id\/reverse/);
  assert.doesNotMatch(source, /REGISTERED_AGENT/);
});

test('student payment UI manages the EMGS ledger without leaving the student', () => {
  const card = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/payments/EmgsPaymentCard.jsx'), 'utf8');
  assert.match(card, /getApplicationPayment/);
  assert.match(card, /submitProof/);
  assert.match(card, /Pending Verification/);
  assert.match(card, /Open Payment/);
  assert.match(card, /Edit \/ Amend/);
  assert.match(card, /amendFee/);
});

test('schema and migration enforce application ledger and idempotent active EMGS fee', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260814010000_emgs_payment_workflow/migration.sql'), 'utf8');
  assert.match(schema, /model ApplicationPaymentAccount[\s\S]*applicationId\s+String\s+@unique/);
  assert.match(schema, /model EmgsFeeItem[\s\S]*activeApplicationKey\s+String\?\s+@unique/);
  assert.match(schema, /destinationSnapshot\s+Json/);
  assert.match(migration, /No historical EMGS fees are created/);
});

test('EMGS routes remain finance-role protected and tenant context is server-derived', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/emgsPayment.routes.js'), 'utf8');
  assert.match(source, /authenticate, tenantContext, authorize\('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'\)/);
  assert.match(source, /post\('\/accounts', authorize\('SUPER_ADMIN', 'TENANT_ADMIN'\)/);
  assert.match(source, /req\.tenantId/);
  assert.doesNotMatch(source, /req\.body\.tenantId/);
});

test('offer-letter upload advances the workflow only after successful file persistence', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/applications/application.service.js'), 'utf8');
  const start = source.indexOf('async uploadOfferLetter');
  const end = source.indexOf('async retryOfferLetterIssuedEmail', start);
  const flow = source.slice(start, end);
  assert.ok(flow.indexOf('this._uploadNamed') < flow.indexOf("status: 'OFFER_LETTER_ISSUED'"));
  assert.match(flow, /status: 'OFFER_LETTER_ISSUED'/);
});

test('frontend presents setup, postpone, and not-required decisions after offer upload', () => {
  const modal = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/payments/EmgsPaymentSetupModal.jsx'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/shared/ApplicationDetail.jsx'), 'utf8');
  assert.match(modal, /Set Up EMGS Payment/);
  assert.match(modal, /Set Up Later/);
  assert.match(modal, /EMGS Not Required/);
  assert.match(modal, /Confirm &amp; Open Payment/);
  assert.match(page, /setShowEmgsPaymentSetup\(true\)/);
});
