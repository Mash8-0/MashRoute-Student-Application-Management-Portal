const assert = require('assert');
const {
  computeMdacEligibility,
} = require('../src/modules/mdac/mdacEligibility');

function check(currentDate, expected, label = currentDate) {
  const result = computeMdacEligibility({
    arrivalDate: '2026-08-10T00:30:00+08:00',
    currentDate,
  });
  assert.equal(result.arrivalDate, '2026-08-10', label);
  assert.equal(result.windowStartDate, '2026-08-08', label);
  assert.equal(result.deadlineDate, '2026-08-10', label);
  assert.equal(result.displayState, expected, label);
}

check('2026-08-07', 'NOT_YET_ELIGIBLE', '7 Aug not yet eligible');
check('2026-08-08', 'ELIGIBLE_NOW', '8 Aug eligible');
check('2026-08-09', 'DUE_TOMORROW', '9 Aug due tomorrow');
check('2026-08-10', 'DUE_TODAY', '10 Aug due today');
check('2026-08-11', 'OVERDUE', '11 Aug overdue');

assert.equal(
  computeMdacEligibility({
    arrivalDate: '2026-01-01T00:10:00+08:00',
    currentDate: '2025-12-30',
  }).displayState,
  'ELIGIBLE_NOW',
  'year boundary window opens two calendar days before arrival'
);

assert.equal(
  computeMdacEligibility({
    arrivalDate: '2028-03-01T00:10:00+08:00',
    currentDate: '2028-02-28',
  }).displayState,
  'ELIGIBLE_NOW',
  'leap year month boundary opens on Feb 28 for Mar 1 arrival'
);

assert.equal(
  computeMdacEligibility({
    arrivalDate: '2026-08-10T00:30:00+08:00',
    currentDate: '2026-08-08T16:30:00Z',
  }).todayDate,
  '2026-08-09',
  'server UTC time converts to Malaysia calendar date'
);

assert.equal(
  computeMdacEligibility({
    arrivalDate: '2026-08-10T00:30:00+08:00',
    currentDate: '2026-08-09',
    mdacStatus: 'SUBMITTED',
  }).displayState,
  'SUBMITTED',
  'submitted stays permanent while unverified'
);

assert.equal(
  computeMdacEligibility({
    arrivalDate: '2026-08-10T00:30:00+08:00',
    previousArrivalDate: '2026-08-09T22:00:00+08:00',
    currentDate: '2026-08-09',
    mdacStatus: 'VERIFIED',
  }).displayState,
  'ARRIVAL_DATE_CHANGED',
  'arrival date change after verification needs review'
);

assert.equal(
  computeMdacEligibility({ arrivalDate: null }).displayState,
  'MISSING_ARRIVAL',
  'missing arrival date is safe'
);

assert.equal(
  computeMdacEligibility({ arrivalDate: 'not-a-date' }).error,
  'Invalid Malaysia arrival date',
  'invalid arrival date is reported'
);

assert.equal(
  computeMdacEligibility({ arrivalDate: '2026-08-10T00:30:00+08:00', mdacRequired: false }).displayState,
  'NOT_REQUIRED',
  'not required is permanent'
);

console.log('MDAC eligibility tests passed');
