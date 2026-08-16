const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSourceShape } = require('../src/modules/students/sourceValidation');
const { maskName } = require('../src/modules/commissions/commission.routes');

test('direct student saves without an agent', () => assert.deepEqual(validateSourceShape('DIRECT_STUDENT', null), { valid: true, sourceAgentId: null }));
test('direct student rejects stale agent id', () => assert.equal(validateSourceShape('DIRECT_STUDENT', 'forged').valid, false));
test('agent sources require an agent', () => assert.equal(validateSourceShape('REGISTERED_AGENT', null).valid, false));
test('all supported agent source categories are accepted', () => {
  for (const type of ['REGISTERED_AGENT','MANAGED_AGENT','REFERRAL_PARTNER']) assert.equal(validateSourceShape(type, 'agent-1').valid, true);
});
test('unknown source is rejected', () => assert.equal(validateSourceShape('UNKNOWN', null).valid, false));
test('commission student names are masked', () => assert.equal(maskName('MD YASIN ALI'), 'M* Y**** A**'));
