const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Super Admin credentials must be supplied through the environment.
// Tenant Admins are created by the Super Admin from within the app; Staff are
// created by each Tenant Admin — so they are NOT seeded here.
async function main() {
  console.log('🌱 Seeding database...');

  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (!email || password.length < 12) {
    throw new Error('Set SUPER_ADMIN_EMAIL and a SUPER_ADMIN_PASSWORD of at least 12 characters before seeding');
  }
  const hashed = await bcrypt.hash(password, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email },
    // Re-seeding re-applies the configured credentials so it's easy to reset.
    update: {
      password: hashed,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
      tenantId: null,
    },
    create: {
      email,
      password: hashed,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Super admin ready:', superAdmin.email);

  if (process.env.SEED_DEMO_DATA === 'true') {
    const demoTenant = await prisma.tenant.upsert({ where: { slug: 'demo-education' }, update: { status: 'ACTIVE' }, create: { name: 'Demo Education', slug: 'demo-education', email: 'demo-tenant@example.test', status: 'ACTIVE' } });
    const demoPassword = await bcrypt.hash('DemoOnly@123!', 12);
    const upsertUser = (email, firstName, lastName, role) => prisma.user.upsert({ where: { email }, update: { tenantId: demoTenant.id, role, isActive: true }, create: { tenantId: demoTenant.id, email, password: demoPassword, firstName, lastName, role, isActive: true, isEmailVerified: true } });
    const [admin, staff, agentUser] = await Promise.all([upsertUser('admin@example.test','Demo','Admin','TENANT_ADMIN'), upsertUser('staff@example.test','Demo','Staff','STAFF'), upsertUser('agent@example.test','Demo','Agent','REGISTERED_AGENT')]);
    await prisma.agentCommission.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.student.updateMany({ where: { tenantId: demoTenant.id }, data: { sourceAgentId: null } });
    await prisma.agent.deleteMany({ where: { tenantId: demoTenant.id } });
    const registered = await prisma.agent.create({ data: { tenantId: demoTenant.id, type: 'REGISTERED_AGENT', displayName: 'Demo Registered Agent', email: 'agent@example.test', status: 'ACTIVE', linkedUserId: agentUser.id, assignedInternalStaffId: staff.id, createdByUserId: admin.id } });
    const managed = await prisma.agent.create({ data: { tenantId: demoTenant.id, type: 'MANAGED_AGENT', displayName: 'Demo Managed Agent', status: 'ACTIVE', assignedInternalStaffId: staff.id, createdByUserId: admin.id } });
    const referral = await prisma.agent.create({ data: { tenantId: demoTenant.id, type: 'REFERRAL_PARTNER', displayName: 'Demo Referral Partner', status: 'ACTIVE', createdByUserId: admin.id } });
    const studentRows = [['DIRECT_STUDENT',null,'DEMO-DIRECT'],['REGISTERED_AGENT',registered.id,'DEMO-REG'],['MANAGED_AGENT',managed.id,'DEMO-MAN'],['REFERRAL_PARTNER',referral.id,'DEMO-REF']];
    const students = [];
    for (const [sourceType, sourceAgentId, passportNumberNormalized] of studentRows) students.push(await prisma.student.upsert({ where: { student_tenant_passport_normalized_unique: { tenantId: demoTenant.id, passportNumberNormalized } }, update: { sourceType, sourceAgentId }, create: { tenantId: demoTenant.id, fullName: `Fake ${sourceType.replaceAll('_',' ')}`, passportNumber: passportNumberNormalized, passportNumberNormalized, sourceType, sourceAgentId, assignedStaffId: staff.id, createdById: admin.id } }));
    const university = await prisma.university.create({ data: { tenantId: demoTenant.id, name: 'Example University', country: 'Malaysia' } });
    for (const [index,status] of ['ELIGIBLE','PENDING','SCHEDULED','PAID'].entries()) { const student = students[(index % 3) + 1]; const sourceAgent = [registered,managed,referral][index % 3]; await prisma.agentCommission.create({ data: { tenantId: demoTenant.id, studentId: student.id, agentId: sourceAgent.id, universityId: university.id, commissionType: 'CLAIMABLE', agentCommission: 500 + index * 100, tenantCommission: 250, grossCommission: 750 + index * 100, status, createdByUserId: admin.id, ...(status === 'PAID' && { paidAt: new Date(), paymentReference: 'DEMO-PAYOUT' }) } }); }
    console.log('✅ Fake tenant, staff, agents, students, and commissions seeded');
  }
  console.log('\n🎉 Database seeded.');
  console.log('\n📋 Login:');
  console.log('   Super Admin:', email, '/', password);
  console.log('   Tenant Admins are created in-app by the Super Admin;');
  console.log('   Staff are created in-app by each Tenant Admin.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
