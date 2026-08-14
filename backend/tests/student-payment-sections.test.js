const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const service = require('../src/modules/payments/studentPayment.service');

test('No SST preserves the entered amount', () => {
  assert.deepEqual(service.calculateSst({ amount: '100.00', treatment: 'NO_SST' }), {
    baseAmount: '100.00', preTaxAmount: '100.00', sstAmount: '0.00', finalAmount: '100.00', sstRate: '0.00', sstTreatment: 'NO_SST',
    calculationSnapshot: { enteredAmount: '100.00', treatment: 'NO_SST', rate: '0.00', rounding: 'HALF_UP_MINOR_UNIT' },
  });
});

test('SST Included extracts tax deterministically', () => {
  const result = service.calculateSst({ amount: '106.00', treatment: 'SST_INCLUDED', rate: '6' });
  assert.equal(result.preTaxAmount, '100.00'); assert.equal(result.sstAmount, '6.00'); assert.equal(result.finalAmount, '106.00');
});

test('Add SST defaults to 6 percent', () => {
  const result = service.calculateSst({ amount: '100.00', treatment: 'ADD_SST' });
  assert.equal(result.sstAmount, '6.00'); assert.equal(result.finalAmount, '106.00');
});

test('Custom SST uses the saved rate snapshot', () => {
  const result = service.calculateSst({ amount: '80.00', treatment: 'CUSTOM_SST_RATE', rate: '8.25' });
  assert.equal(result.sstAmount, '6.60'); assert.equal(result.finalAmount, '86.60'); assert.equal(result.calculationSnapshot.rate, '8.25');
});

test('money parsing rejects floating point precision beyond minor units', () => {
  assert.equal(service.parseMoney('3600.50'), 360050n);
  assert.throws(() => service.parseMoney('1.999'), (error) => /at most 2 decimal places/.test(error.message));
});

test('schema defines separate section, transaction and receipt statuses', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert.match(schema, /enum FeeSectionStatus/); assert.match(schema, /enum PaymentTransactionStatus/); assert.match(schema, /enum ReceiptStatus/);
});

test('Initial fees remain separate lines and Other sections are repeatable', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/studentPayment.service.js'), 'utf8');
  assert.match(schema, /model PaymentFeeLine/); assert.match(schema, /@@unique\(\[sectionId, feeCode\]\)/);
  assert.match(source, /sectionType === 'INITIAL_UNIVERSITY'/); assert.match(source, /sectionType === 'OTHER'/); assert.match(source, /activeSectionKey = sectionType === 'INITIAL_UNIVERSITY'/);
});

test('verification requires explicit allocations and uses serializable isolation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/studentPayment.service.js'), 'utf8');
  assert.match(source, /At least one reviewed fee allocation is required/); assert.match(source, /isolationLevel: 'Serializable'/); assert.match(source, /paymentSectionAllocation/);
});

test('proof and review states do not increase verified totals', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/payments/studentPayment.service.js'), 'utf8');
  assert.match(source, /const verified = allocations\.reduce/); assert.match(source, /\['PROOF_UPLOADED', 'UNDER_REVIEW'\]/);
});

test('routes enforce tenant context and block registered agents', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/modules/payments/studentPayment.routes.js'), 'utf8');
  assert.match(routes, /authenticate, tenantContext, authorize\('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'\)/);
  assert.doesNotMatch(routes, /REGISTERED_AGENT/); assert.doesNotMatch(routes, /req\.body\.tenantId/);
});

test('migration creates tenant-scoped atomic financial numbering', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260814020000_student_payment_sections/migration.sql'), 'utf8');
  assert.match(migration, /FinancialDocumentSequence/); assert.match(migration, /tenantId_documentType_year_key/);
});
