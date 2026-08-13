// One-time backfill for Student.createdById (added for staff-scoped visibility).
//
// Existing students predate the createdById column, so STAFF couldn't see any of
// them. This attributes each student to whoever created its earliest application
// (createdById, falling back to the assigned agentId). Students with no
// application are attributed to an active Tenant Admin in the same tenant.
//
// Idempotent: only touches rows where createdById IS NULL.
// Dry run:  DRY_RUN=1 node scripts/backfill-student-creator.js
// Apply:    node scripts/backfill-student-creator.js
require('dotenv').config();
const prisma = require('../src/config/database');

async function main() {
  const dry = process.env.DRY_RUN === '1';
  const students = await prisma.student.findMany({
    where: { createdById: null, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      applications: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdById: true, agentId: true },
      },
    },
  });

  let updated = 0;
  let fromApplication = 0;
  let fromTenantAdmin = 0;
  let skipped = 0; // no application and no active tenant admin
  const tenantAdminByTenant = new Map();

  for (const s of students) {
    const app = s.applications[0];
    let creator = app?.createdById || app?.agentId || null;
    let source = creator ? 'application' : null;

    if (!creator) {
      if (!tenantAdminByTenant.has(s.tenantId)) {
        const admin = await prisma.user.findFirst({
          where: {
            tenantId: s.tenantId,
            role: 'TENANT_ADMIN',
            isActive: true,
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        tenantAdminByTenant.set(s.tenantId, admin?.id || null);
      }

      creator = tenantAdminByTenant.get(s.tenantId);
      source = creator ? 'tenant-admin' : null;
    }

    if (!creator) { skipped++; continue; }
    if (!dry) {
      await prisma.student.update({ where: { id: s.id }, data: { createdById: creator } });
    }
    if (source === 'application') fromApplication++;
    if (source === 'tenant-admin') fromTenantAdmin++;
    updated++;
  }

  console.log(
    `${dry ? '[DRY RUN] ' : ''}Backfill: ${students.length} students with no creator → ` +
    `${updated} ${dry ? 'would be ' : ''}updated ` +
    `(${fromApplication} from applications, ${fromTenantAdmin} from tenant admin fallback), ` +
    `${skipped} skipped (no active tenant admin fallback).`
  );
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
