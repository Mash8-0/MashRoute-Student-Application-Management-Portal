const test = require('node:test');
const assert = require('node:assert/strict');
const applicationService = require('../src/modules/applications/application.service');

test('admin status workflow permits any backward jump', () => {
  assert.equal(applicationService.isStatusTransitionAllowed('OFFER_LETTER_ISSUED', 'AWAITING_OFFER_LETTER'), true);
  assert.equal(applicationService.isStatusTransitionAllowed('OFFER_LETTER_ISSUED', 'AWAITING_VERIFICATION'), true);
  assert.equal(applicationService.isStatusTransitionAllowed('COMPLETED', 'SENT_TO_UNIVERSITY'), true);
});

test('admin status workflow still prevents skipping forward stages', () => {
  assert.equal(applicationService.isStatusTransitionAllowed('AWAITING_VERIFICATION', 'SENT_TO_UNIVERSITY'), true);
  assert.equal(applicationService.isStatusTransitionAllowed('AWAITING_VERIFICATION', 'AWAITING_OFFER_LETTER'), false);
});

test('admin may reject at any point and recover a rejected application', () => {
  assert.equal(applicationService.isStatusTransitionAllowed('AWAITING_VERIFICATION', 'REJECTED'), true);
  assert.equal(applicationService.isStatusTransitionAllowed('REJECTED', 'AWAITING_VERIFICATION'), true);
  assert.equal(applicationService.isStatusTransitionAllowed('REJECTED', 'OFFER_LETTER_ISSUED'), true);
});
