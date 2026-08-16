const { PrismaClient } = require('@prisma/client');
const {
  CITY_UNIVERSITY_INTAKES_2026,
  cityProgrammeCourses,
} = require('../src/utils/cityUniversity');

const prisma = new PrismaClient();

async function main() {
  const assignedTenantIds = process.argv.slice(2);
  const existing = await prisma.university.findFirst({
    where: {
      tenantId: null,
      name: { contains: 'City University Malaysia', mode: 'insensitive' },
    },
    select: { id: true },
  });

  const data = {
    name: 'City University Malaysia',
    code: 'CITY-MY',
    country: 'Malaysia',
    city: 'Petaling Jaya / Cyberjaya / Johor Bahru',
    courses: cityProgrammeCourses(),
    intakes: CITY_UNIVERSITY_INTAKES_2026,
    isActive: true,
    ...(assignedTenantIds.length && {
      assignedTenants: { set: assignedTenantIds.map((id) => ({ id })) },
    }),
  };

  const university = existing
    ? await prisma.university.update({ where: { id: existing.id }, data, select: { id: true, name: true, courses: true, intakes: true } })
    : await prisma.university.create({ data, select: { id: true, name: true, courses: true, intakes: true } });

  console.log(JSON.stringify({
    id: university.id,
    name: university.name,
    courseCount: university.courses.length,
    intakes: university.intakes,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
