// One-time/idempotent backfill for Application commission snapshot fields.
//
// Snapshot rules:
// 1. assigned agent's category
// 2. program-specific university commission for that category
// 3. university default commission for that category
//
// Dry run:  DRY_RUN=1 node scripts/backfill-application-commissions.js
// Apply:    node scripts/backfill-application-commissions.js
require('dotenv').config();
const prisma = require('../src/config/database');

async function resolveSnapshot(app) {
  if (!app.tenantId || !app.universityId || !app.agentId) {
    return {
      commissionCategory: null,
      commissionCourse: null,
      commissionAmount: null,
      commissionType: null,
      commissionCurrency: null,
    };
  }

  const agent = await prisma.user.findFirst({
    where: { id: app.agentId, tenantId: app.tenantId, deletedAt: null },
    select: { agentCategory: true },
  });
  const category = agent?.agentCategory || 'STANDARD';
  const course = typeof app.program === 'string' ? app.program.trim() : '';

  const rows = await prisma.universityCommission.findMany({
    where: {
      tenantId: app.tenantId,
      universityId: app.universityId,
      category,
      amount: { gt: 0 },
      course: { in: course ? [course, ''] : [''] },
    },
  });
  const row = rows.find((r) => r.course === course) || rows.find((r) => !r.course);

  if (!row) {
    return {
      commissionCategory: category,
      commissionCourse: null,
      commissionAmount: null,
      commissionType: null,
      commissionCurrency: null,
    };
  }

  return {
    commissionCategory: category,
    commissionCourse: row.course || null,
    commissionAmount: row.amount,
    commissionType: row.type,
    commissionCurrency: row.currency || 'MYR',
  };
}

async function main() {
  const dry = process.env.DRY_RUN === '1';
  const apps = await prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      universityId: true,
      agentId: true,
      program: true,
      commissionAmount: true,
    },
  });

  let updated = 0;
  let withRate = 0;
  let withoutRate = 0;

  for (const app of apps) {
    const snapshot = await resolveSnapshot(app);
    if (snapshot.commissionAmount != null) withRate++;
    else withoutRate++;

    if (!dry) {
      await prisma.application.update({
        where: { id: app.id },
        data: snapshot,
      });
    }
    updated++;
  }

  console.log(
    `${dry ? '[DRY RUN] ' : ''}Application commission backfill: ${updated} applications ` +
    `${dry ? 'would be ' : ''}updated (${withRate} with rates, ${withoutRate} without matching rates).`
  );
}

main()
  .catch((e) => {
    console.error('Application commission backfill failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
