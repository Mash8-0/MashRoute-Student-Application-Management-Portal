const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const STUDENT_ALREADY_EXISTS_ERROR = {
  statusCode: 409,
  code: 'STUDENT_ALREADY_EXISTS',
  message: 'Student Record Already Exists',
};

class StudentService {
  async createStudent(tenantId, data) {
    if (!tenantId) {
      throw { statusCode: 400, message: 'No tenant context' };
    }

    // Check student limit
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const studentCount = await prisma.student.count({ where: { tenantId, deletedAt: null } });
    if (studentCount >= (tenant?.maxStudents || 100)) {
      throw { statusCode: 400, message: 'Student limit reached for this plan' };
    }

    const studentData = this._cleanStudentData(data);
    this._validateStudentData(studentData);
    await this._assertNoDuplicate(tenantId, studentData);

    try {
      return await prisma.student.create({
        data: { tenantId, ...studentData },
      });
    } catch (err) {
      this._handleUniqueConstraintError(err);
      throw err;
    }
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
    if (!id || typeof id !== 'string') {
      throw { statusCode: 400, message: 'Missing student ID' };
    }

    const currentStudent = await this._assertExists(id, tenantId);
    const studentData = this._cleanStudentData(data);
    this._validateStudentData(studentData, { partial: true });
    const duplicateChecks = this._getChangedDuplicateChecks(currentStudent, studentData);

    if (!duplicateChecks.passport) {
      studentData.passportNumberNormalized = currentStudent.passportNumberNormalized;
    }

    await this._assertNoDuplicate(tenantId, studentData, id, duplicateChecks);

    try {
      return await prisma.student.update({
        where: { id },
        data: studentData,
      });
    } catch (err) {
      this._handleUniqueConstraintError(err);
      throw err;
    }
  }

  async deleteStudent(id, tenantId) {
    await this._assertExists(id, tenantId);
    return prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, passportNumberNormalized: null },
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
    const cleaned = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(data, key);
    const setText = (key) => {
      if (has(key)) cleaned[key] = this._normalizeOptionalText(data[key]) ?? null;
    };
    const setInt = (key) => {
      if (!has(key)) return;
      const value = this._normalizeOptionalText(data[key]);
      cleaned[key] = value === undefined ? null : parseInt(value);
    };
    const setDecimal = (key) => {
      if (!has(key)) return;
      const value = this._normalizeOptionalText(data[key]);
      cleaned[key] = value === undefined ? null : value;
    };
    const setDate = (key) => {
      if (!has(key)) return;
      const value = this._normalizeOptionalText(data[key]);
      cleaned[key] = value === undefined ? null : new Date(value);
    };
    const setBoolean = (key) => {
      if (has(key)) cleaned[key] = Boolean(data[key]);
    };

    if (has('fullName')) cleaned.fullName = this._normalizeOptionalText(data.fullName);
    if (has('passportNumber')) {
      const passportNumber = this._normalizePassportDisplay(data.passportNumber);
      cleaned.passportNumber = passportNumber ?? null;
      cleaned.passportNumberNormalized = this._normalizePassportNumber(passportNumber) ?? null;
    }

    setDate('dateOfBirth');
    setText('gender');
    setText('nationality');
    setText('phone');
    if (has('email')) cleaned.email = this._normalizeEmail(data.email) ?? null;
    setText('address');
    setText('city');
    setText('country');
    setText('sponsorName');
    setText('sponsorContact');
    setText('emergencyContact');
    setText('emergencyPhone');
    setText('whatsapp');

    setText('sscGrade');
    setInt('sscYear');
    setText('sscInstitution');
    setText('hscGrade');
    setInt('hscYear');
    setText('hscInstitution');
    setText('diplomaGrade');
    setInt('diplomaYear');
    setText('diplomaInstitution');
    setText('bachelorGrade');
    setInt('bachelorYear');
    setText('bachelorInstitution');
    setText('mastersGrade');
    setInt('mastersYear');
    setText('mastersInstitution');
    setText('phdGrade');
    setInt('phdYear');
    setText('phdInstitution');
    setDecimal('gpa');

    setBoolean('hasIELTS');
    setDecimal('ieltsScore');
    setDate('ieltsExpiry');
    setBoolean('hasPTE');
    setInt('pteScore');
    setDate('pteExpiry');
    setBoolean('hasMOI');
    setText('photo');

    return cleaned;
  }

  async _assertNoDuplicate(
    tenantId,
    data,
    excludeStudentId = null,
    checks = { passport: true, email: true, phone: true }
  ) {
    const baseWhere = {
      tenantId,
      deletedAt: null,
      ...(excludeStudentId && { id: { not: excludeStudentId } }),
    };

    if (checks.passport && data.passportNumberNormalized) {
      const existingNormalizedPassport = await prisma.student.findFirst({
        where: { ...baseWhere, passportNumberNormalized: data.passportNumberNormalized },
        select: { id: true },
      });

      if (existingNormalizedPassport) {
        throw { ...STUDENT_ALREADY_EXISTS_ERROR };
      }

      const existingPassportMatches = await prisma.student.findMany({
        where: { ...baseWhere, passportNumber: { not: null } },
        select: { id: true, passportNumber: true },
      });

      if (
        existingPassportMatches.some(
          (student) => this._normalizePassportNumber(student.passportNumber) === data.passportNumberNormalized
        )
      ) {
        throw { ...STUDENT_ALREADY_EXISTS_ERROR };
      }
    }

    const secondaryChecks = [];
    if (checks.email && data.email) {
      secondaryChecks.push({ email: { equals: data.email, mode: 'insensitive' } });
    }
    if (checks.phone && data.phone) {
      secondaryChecks.push({ phone: data.phone });
    }

    if (secondaryChecks.length === 0) return;

    const existing = await prisma.student.findFirst({
      where: {
        ...baseWhere,
        OR: secondaryChecks,
      },
      select: { id: true },
    });

    if (existing) {
      throw { ...STUDENT_ALREADY_EXISTS_ERROR };
    }
  }

  _getChangedDuplicateChecks(currentStudent, data) {
    const currentPassport = this._normalizePassportNumber(currentStudent.passportNumber);
    const currentEmail = this._normalizeEmail(currentStudent.email);
    const currentPhone = this._normalizeOptionalText(currentStudent.phone);

    return {
      passport: Object.prototype.hasOwnProperty.call(data, 'passportNumberNormalized') &&
        data.passportNumberNormalized !== currentPassport,
      email: Object.prototype.hasOwnProperty.call(data, 'email') && data.email !== currentEmail,
      phone: Object.prototype.hasOwnProperty.call(data, 'phone') && data.phone !== currentPhone,
    };
  }

  _handleUniqueConstraintError(err) {
    const target = err?.meta?.target;
    const uniqueTarget = Array.isArray(target) ? target.join(',') : target;

    if (
      err?.code === 'P2002' &&
      typeof uniqueTarget === 'string' &&
      uniqueTarget.includes('passportNumberNormalized')
    ) {
      throw { ...STUDENT_ALREADY_EXISTS_ERROR };
    }
  }

  _normalizeOptionalText(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  _normalizePassportDisplay(value) {
    const trimmed = this._normalizeOptionalText(value);
    return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
  }

  _normalizeEmail(value) {
    const trimmed = this._normalizeOptionalText(value);
    return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
  }

  _normalizePassportNumber(value) {
    const trimmed = this._normalizeOptionalText(value);
    return typeof trimmed === 'string' ? trimmed.toUpperCase().replace(/\s+/g, '') : undefined;
  }

  _validateStudentData(data, { partial = false } = {}) {
    if (!partial && !data.fullName) {
      throw { statusCode: 422, message: 'Full name is required' };
    }

    if (Object.prototype.hasOwnProperty.call(data, 'fullName') && !data.fullName) {
      throw { statusCode: 422, message: 'Full name is required' };
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw { statusCode: 422, message: 'Invalid email' };
    }

    if (data.phone && !/^\+?[0-9()\-.\s]{5,30}$/.test(data.phone)) {
      throw { statusCode: 422, message: 'Invalid phone number' };
    }

    if (data.passportNumber && !/^[A-Z0-9][A-Z0-9\-\s]{2,29}$/.test(data.passportNumber)) {
      throw { statusCode: 422, message: 'Invalid passport number' };
    }
  }
}

module.exports = new StudentService();
