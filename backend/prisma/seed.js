const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default Super Admin. Override via SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in .env.
// Tenant Admins are created by the Super Admin from within the app; Staff are
// created by each Tenant Admin — so they are NOT seeded here.
async function main() {
  console.log('🌱 Seeding database...');

  const email = (process.env.SUPER_ADMIN_EMAIL || 'mashroute.store@gmail.com').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'M@shrur1308';
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
