const { PrismaClient } = require('@prisma/client');
const { ALFA_INTAKES_2026, ALFA_PROGRAMMES } = require('../src/utils/alfaUniversity');

const prisma = new PrismaClient();

async function main() {
  const tenantId = process.argv[2] || null;
  const where = {
    name: { contains: 'ALFA University College', mode: 'insensitive' },
    ...(tenantId ? { tenantId } : { tenantId: null }),
  };

  const existing = await prisma.university.findFirst({
    where,
    select: { id: true },
  });

  const data = {
    name: 'ALFA University College',
    code: 'AUC-MY',
    country: 'Malaysia',
    city: 'Subang Jaya',
    courses: ALFA_PROGRAMMES,
    intakes: ALFA_INTAKES_2026,
    isActive: true,
    ...(tenantId ? { tenantId } : {}),
  };

  const university = existing
    ? await prisma.university.update({ where: { id: existing.id }, data, select: { id: true, name: true, courses: true, intakes: true, tenantId: true } })
    : await prisma.university.create({ data, select: { id: true, name: true, courses: true, intakes: true, tenantId: true } });

  const counts = university.courses.reduce((acc, course) => {
    acc[course.level] = (acc[course.level] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    id: university.id,
    tenantId: university.tenantId,
    name: university.name,
    counts,
    intakes: university.intakes,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
