const { MDAC_TIMEZONE, MDAC_URL, MDAC_WINDOW_DAYS } = require('./mdac.constants');

function partsInMalaysia(value, timeZone = MDAC_TIMEZONE) {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    isoDate: `${map.year}-${map.month}-${map.day}`,
  };
}

function parseCalendarDate(dateString) {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    isoDate: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    isoDate: date.toISOString().slice(0, 10),
  };
}

function compareCalendarDates(a, b) {
  if (a.isoDate < b.isoDate) return -1;
  if (a.isoDate > b.isoDate) return 1;
  return 0;
}

function calendarDayDiff(a, b) {
  const aTime = Date.UTC(a.year, a.month - 1, a.day);
  const bTime = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((aTime - bTime) / 86400000);
}

function resolvePermanentState(record = {}) {
  if (record.mdacStatus) return record.mdacStatus;
  if (record.mdacVerifiedAt) return 'VERIFIED';
  if (record.mdacSubmittedAt || record.mdacProofUrl) return 'SUBMITTED';
  if (record.mdacRequired === false) return 'NOT_REQUIRED';
  return 'REQUIRED';
}

function computeMdacEligibility({
  arrivalDate,
  currentDate = new Date(),
  previousArrivalDate = null,
  mdacRequired = true,
  mdacStatus = null,
  timezone = MDAC_TIMEZONE,
  windowDays = MDAC_WINDOW_DAYS,
} = {}) {
  const permanentState = mdacRequired === false ? 'NOT_REQUIRED' : (mdacStatus || 'REQUIRED');
  if (permanentState === 'NOT_REQUIRED') {
    return {
      permanentState,
      displayState: 'NOT_REQUIRED',
      timezone,
      officialUrl: MDAC_URL,
      windowDays,
    };
  }

  const arrivalParts = partsInMalaysia(arrivalDate, timezone);
  if (!arrivalParts) {
    return {
      permanentState,
      displayState: 'MISSING_ARRIVAL',
      timezone,
      officialUrl: MDAC_URL,
      windowDays,
      error: arrivalDate ? 'Invalid Malaysia arrival date' : null,
    };
  }

  const todayParts = typeof currentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)
    ? parseCalendarDate(currentDate)
    : partsInMalaysia(currentDate, timezone);
  if (!todayParts) {
    throw new Error('Invalid current date for MDAC calculation');
  }

  const windowStart = addCalendarDays(arrivalParts, -(windowDays - 1));
  const previousParts = previousArrivalDate ? partsInMalaysia(previousArrivalDate, timezone) : null;
  const arrivalChanged = Boolean(previousParts && previousParts.isoDate !== arrivalParts.isoDate);
  const daysUntilArrival = calendarDayDiff(arrivalParts, todayParts);

  let displayState = 'ELIGIBLE_NOW';
  if (permanentState === 'VERIFIED') displayState = arrivalChanged ? 'ARRIVAL_DATE_CHANGED' : 'VERIFIED';
  else if (permanentState === 'SUBMITTED') displayState = arrivalChanged ? 'ARRIVAL_DATE_CHANGED' : 'SUBMITTED';
  else if (permanentState === 'NEEDS_REVIEW') displayState = 'NEEDS_REVIEW';
  else if (compareCalendarDates(todayParts, windowStart) < 0) displayState = 'NOT_YET_ELIGIBLE';
  else if (daysUntilArrival === 1) displayState = 'DUE_TOMORROW';
  else if (daysUntilArrival === 0) displayState = 'DUE_TODAY';
  else if (daysUntilArrival < 0) displayState = 'OVERDUE';

  return {
    permanentState,
    displayState,
    timezone,
    officialUrl: MDAC_URL,
    windowDays,
    arrivalDate: arrivalParts.isoDate,
    windowStartDate: windowStart.isoDate,
    deadlineDate: arrivalParts.isoDate,
    todayDate: todayParts.isoDate,
    daysUntilArrival,
    arrivalDateChanged: arrivalChanged,
  };
}

module.exports = {
  addCalendarDays,
  calendarDayDiff,
  compareCalendarDates,
  computeMdacEligibility,
  partsInMalaysia,
  resolvePermanentState,
};
