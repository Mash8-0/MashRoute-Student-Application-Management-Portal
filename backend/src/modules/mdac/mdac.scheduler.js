const mdacService = require('./mdac.service');
const logger = require('../../config/logger');

let timer = null;

function startMdacScheduler() {
  if (process.env.NODE_ENV === 'test' || process.env.MDAC_REMINDERS_ENABLED === 'false') return null;
  if (timer) return timer;

  const intervalMs = Math.max(60 * 60 * 1000, parseInt(process.env.MDAC_REMINDER_INTERVAL_MS || `${6 * 60 * 60 * 1000}`, 10));
  timer = setInterval(async () => {
    try {
      const result = await mdacService.runDailyReminders();
      logger.info(`MDAC reminders scanned=${result.scanned} sent=${result.sent}`);
    } catch (err) {
      logger.error('MDAC reminder run failed:', err);
    }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { startMdacScheduler };
