const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class StudentService {
  async createStudent(tenantId, data) {
    // Check student limit
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const studentCount = await prisma.student.count({ where: { tenantId, deletedAt: null } });
    if (studentCount >= (tenant?.maxStudents || 100)) {
      throw { statusCode: 400, message: 'Student limit reached for this plan' };
    }

    return prisma.student.create({
      data: { tenantId, ...this._cleanStudentData(data) },
    });
  }

  async listStudents(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const { search, nationality, hasIELTS } = query;

    const where = {
      // SUPER_ADMIN has tenantId null → omit filter to see all tenants' students
      ...(tenantId && { tenantId }),
      deletedAt: null,
      ...(nationality && { nationality }),
      ...(hasIELTS !== undefined && { hasIELTS: hasIELTS === 'true' }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { passportNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { applications: true, documents: true } },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, pagination: getPaginationMeta(total, page, limit) };
  }

  async getStudent(id, tenantId) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: null },
      include: {
        applications: {
          include: {
            university: { select: { name: true, country: true } },
            agent: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { applications: true, documents: true, payments: true } },
      },
    });
    if (!student) throw { statusCode: 404, message: 'Student not found' };
    return student;
  }

  async updateStudent(id, tenantId, data) {
    await this._assertExists(id, tenantId);
    return prisma.student.update({
      where: { id },
      data: this._cleanStudentData(data),
    });
  }

  async deleteStudent(id, tenantId) {
    await this._assertExists(id, tenantId);
    return prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async _assertExists(id, tenantId) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: null },
    });
    if (!student) throw { statusCode: 404, message: 'Student not found' };
    return student;
  }

  _cleanStudentData(data) {
    return {
      fullName: data.fullName,
      passportNumber: data.passportNumber,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      nationality: data.nationality,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      country: data.country,
      sponsorName: data.sponsorName,
      sponsorContact: data.sponsorContact,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      // Academic
      sscGrade: data.sscGrade,
      sscYear: data.sscYear ? parseInt(data.sscYear) : undefined,
      sscInstitution: data.sscInstitution,
      hscGrade: data.hscGrade,
      hscYear: data.hscYear ? parseInt(data.hscYear) : undefined,
      hscInstitution: data.hscInstitution,
      diplomaGrade: data.diplomaGrade,
      diplomaYear: data.diplomaYear ? parseInt(data.diplomaYear) : undefined,
      diplomaInstitution: data.diplomaInstitution,
      bachelorGrade: data.bachelorGrade,
      bachelorYear: data.bachelorYear ? parseInt(data.bachelorYear) : undefined,
      bachelorInstitution: data.bachelorInstitution,
      mastersGrade: data.mastersGrade,
      mastersYear: data.mastersYear ? parseInt(data.mastersYear) : undefined,
      mastersInstitution: data.mastersInstitution,
      gpa: data.gpa,
      // English
      hasIELTS: data.hasIELTS,
      ieltsScore: data.ieltsScore,
      ieltsExpiry: data.ieltsExpiry ? new Date(data.ieltsExpiry) : undefined,
      hasPTE: data.hasPTE,
      pteScore: data.pteScore ? parseInt(data.pteScore) : undefined,
      pteExpiry: data.pteExpiry ? new Date(data.pteExpiry) : undefined,
      hasMOI: data.hasMOI,
      photo: data.photo,
    };
  }
}

module.exports = new StudentService();
