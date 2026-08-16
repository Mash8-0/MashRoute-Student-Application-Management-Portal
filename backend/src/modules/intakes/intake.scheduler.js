const cron = require('node-cron');
const prisma = require('../../config/database');
const logger = require('../../config/logger');

async function notifyAdmins(tx, intake, event, title, message) {
  const dedupeKey = `intake:${intake.id}:${event}`;
  const exists = await tx.notification.findFirst({ where: { tenantId: intake.tenantId, metadata: { path: ['dedupeKey'], equals: dedupeKey } }, select: { id: true } });
  if (exists) return;
  const admins = await tx.user.findMany({ where: { tenantId: intake.tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null }, select: { id: true } });
  if (admins.length) await tx.notification.createMany({ data: admins.map(({ id }) => ({ tenantId: intake.tenantId, userId: id, type: 'SYSTEM', title, message, metadata: { dedupeKey, intakeId: intake.id, event } })) });
}

async function processIntakes() {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 86400000);
  const rows = await prisma.intake.findMany({
    where: { isActive: true, status: { in: ['UPCOMING', 'OPEN', 'CLOSING_SOON'] } },
    include: {
      _count: { select: { applications: { where: { deletedAt: null } } } },
    },
  });
  for (const intake of rows) {
    await prisma.$transaction(async (tx) => {
      if (intake.availableSeats === 0 && intake.status !== 'FULL') {
        await tx.intake.update({ where: { id: intake.id }, data: { status: 'FULL' } });
        await notifyAdmins(tx, intake, 'full', 'Intake is full', `${intake.programmeName} · ${intake.intakeMonth}/${intake.intakeYear} has no seats remaining.`);
      } else if (intake.internationalApplicationDeadline && intake.internationalApplicationDeadline < now) {
        await tx.intake.update({ where: { id: intake.id }, data: { status: 'CLOSED' } });
        await notifyAdmins(tx, intake, 'deadline-passed', 'Intake deadline passed', `${intake.programmeName} is now closed to international applications.`);
      } else if (intake.internationalApplicationDeadline && intake.internationalApplicationDeadline <= soon && intake.status !== 'CLOSING_SOON') {
        await tx.intake.update({ where: { id: intake.id }, data: { status: 'CLOSING_SOON' } });
        await notifyAdmins(tx, intake, 'closing-soon', 'Intake closing soon', `${intake.programmeName} closes on ${intake.internationalApplicationDeadline.toLocaleDateString('en-MY')}.`);
      }
    });
  }
}

function startIntakeScheduler() {
  processIntakes().catch((error) => logger.error('Intake scheduler:', error));
  cron.schedule('17 */6 * * *', () => processIntakes().catch((error) => logger.error('Intake scheduler:', error)), { timezone: 'Asia/Kuala_Lumpur' });
}

module.exports = { startIntakeScheduler, processIntakes };
