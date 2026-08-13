const MDAC_TIMEZONE = process.env.MDAC_TIMEZONE || 'Asia/Kuala_Lumpur';
const MDAC_WINDOW_DAYS = Math.max(1, parseInt(process.env.MDAC_WINDOW_DAYS || '3', 10) || 3);
const MDAC_URL = process.env.MDAC_URL || 'https://imigresen-online.imi.gov.my/mdac/register';

const PERMANENT_STATES = ['NOT_REQUIRED', 'REQUIRED', 'SUBMITTED', 'VERIFIED', 'NEEDS_REVIEW'];
const DISPLAY_STATES = [
  'MISSING_ARRIVAL',
  'NOT_REQUIRED',
  'NOT_YET_ELIGIBLE',
  'ELIGIBLE_NOW',
  'DUE_TOMORROW',
  'DUE_TODAY',
  'OVERDUE',
  'SUBMITTED',
  'VERIFIED',
  'NEEDS_REVIEW',
  'ARRIVAL_DATE_CHANGED',
];

module.exports = {
  DISPLAY_STATES,
  MDAC_TIMEZONE,
  MDAC_URL,
  MDAC_WINDOW_DAYS,
  PERMANENT_STATES,
};
