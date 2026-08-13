const { PrismaClient } = require('@prisma/client');
const { INTI_CAMPUSES, INTI_PROGRAMMES } = require('../src/utils/intiUniversity');

const prisma = new PrismaClient();

async function main() {
  const assignedTenantIds = process.argv.slice(2);
  const where = {
    OR: [
      { name: { contains: 'INTI International University & Colleges', mode: 'insensitive' } },
      { name: { contains: 'INTI International University', mode: 'insensitive' } },
      { name: { contains: 'INTI INTERNATIONAL UNIVERSITY COLLEGE', mode: 'insensitive' } },
    ],
  };

  const existing = await prisma.university.findMany({ where, select: { id: true, name: true } });
  const data = {
    name: 'INTI International University & Colleges',
    code: 'INTI',
    country: 'Malaysia',
    city: 'Subang Jaya / Nilai / Penang',
    courses: INTI_PROGRAMMES,
    intakes: [],
    isActive: true,
    ...(assignedTenantIds.length && {
      assignedTenants: { set: assignedTenantIds.map((id) => ({ id })) },
    }),
  };

  const universities = existing.length
    ? await Promise.all(existing.map((item) => prisma.university.update({
      where: { id: item.id },
      data: { ...data, ...(item.name !== data.name ? {} : {}) },
      select: { id: true, name: true, courses: true },
    })))
    : [await prisma.university.create({ data, select: { id: true, name: true, courses: true } })];

  const counts = INTI_CAMPUSES.reduce((acc, campus) => {
    acc[campus.code] = INTI_PROGRAMMES.filter((course) => Array.isArray(course.campusCodes) && course.campusCodes.includes(campus.code)).length;
    return acc;
  }, {});

  console.log(JSON.stringify({
    updated: universities.map((university) => ({ id: university.id, name: university.name })),
    campuses: INTI_CAMPUSES.map((campus) => ({ code: campus.code, label: campus.label })),
    programmeCount: INTI_PROGRAMMES.length,
    counts,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
