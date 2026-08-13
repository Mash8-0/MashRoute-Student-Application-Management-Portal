// Creates only programme-specific INTI regular intakes already declared in the
// university catalogue. October and all optional intake types remain disabled
// until a Tenant Admin explicitly creates them in Intake Management.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MONTHS = { january: 1, april: 4, may: 5, july: 7, august: 8 };

function parseIntake(value) {
  const match = String(value || '').trim().match(/^(January|April|May|July|August)(?:\s+(20\d{2}))?$/i);
  return match ? { month: MONTHS[match[1].toLowerCase()], year: match[2] ? Number(match[2]) : new Date().getFullYear() + 1 } : null;
}

async function main() {
  const universities = await prisma.university.findMany({
    where: { name: { contains: 'INTI', mode: 'insensitive' }, isActive: true },
    include: { assignedTenants: { select: { id: true } } },
  });
  let created = 0;
  for (const university of universities) {
    const tenantIds = [...new Set([university.tenantId, ...university.assignedTenants.map(({ id }) => id)].filter(Boolean))];
    for (const tenantId of tenantIds) for (const course of (Array.isArray(university.courses) ? university.courses : [])) {
      const campusCodes = course.campusCodes || [];
      const intakes = (course.intakes || []).map(parseIntake).filter(Boolean);
      for (const campusCode of campusCodes) for (const intake of intakes) {
        const campusIndex = campusCodes.indexOf(campusCode);
        const campusName = course.campuses?.[campusIndex] || campusCode;
        const intakeDate = new Date(Date.UTC(intake.year, intake.month - 1, 1));
        await prisma.intake.upsert({
          where: { tenantId_universityId_campusId_programmeId_intakeMonth_intakeYear_intakeType: { tenantId, universityId: university.id, campusId: `${university.id}:${campusCode}`, programmeId: `${university.id}:${course.name}`, intakeMonth: intake.month, intakeYear: intake.year, intakeType: 'REGULAR' } },
          create: { tenantId, universityId: university.id, campusId: `${university.id}:${campusCode}`, campusCode, campusName, programmeId: `${university.id}:${course.name}`, programmeName: course.name, studyLevel: course.level || null, intakeMonth: intake.month, intakeYear: intake.year, intakeDate, intakeType: 'REGULAR', status: 'DRAFT', isActive: false, isAvailableForInternationalStudents: true, notes: 'Imported from the existing INTI programme catalogue; review dates and activate before use.' },
          update: {},
        });
        created += 1;
      }
    }
  }
  console.log(`INTI intake configurations processed: ${created}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
