const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { validateSourceShape } = require('./sourceValidation');

const STUDENT_ALREADY_EXISTS_ERROR = {
  statusCode: 409,
  code: 'STUDENT_ALREADY_EXISTS',
  message: 'Student Record Already Exists',
};

class StudentService {
  async createStudent(tenantId, data, userId = null) {
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
    Object.assign(studentData, await this._validateSource(tenantId, data, true));
    studentData.assignedStaffId = await this._validateAssignedStaff(tenantId, data.assignedStaffId);
    await this._assertNoDuplicate(tenantId, studentData);

    try {
      return await prisma.student.create({
        data: { tenantId, createdById: userId, ...studentData },
      });
    } catch (err) {
      this._handleUniqueConstraintError(err);
      throw err;
    }
  }

  async listStudents(tenantId, query, userRole = null, userId = null) {
    const { page, limit, skip } = getPagination(query);
    const { search, nationality, hasIELTS } = query;

    const where = {
      // SUPER_ADMIN has tenantId null → omit filter to see all tenants' students
      ...(tenantId && { tenantId }),
      ...this._studentAccessScope(userRole, userId),
      deletedAt: null,
      ...(nationality && { nationality }),
      ...(hasIELTS !== undefined && { hasIELTS: hasIELTS === 'true' }),
      ...(query.sourceType && { sourceType: query.sourceType }),
      ...(query.sourceAgentId && { sourceAgentId: query.sourceAgentId }),
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
          sourceAgent: { select: { id: true, displayName: true, type: true, status: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
          documents: {
            where: { type: 'PHOTO', isActive: true, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, type: true, fileUrl: true, driveViewLink: true, deletedAt: true },
          },
          _count: {
            select: {
              applications: { where: { deletedAt: null } },
              documents: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, pagination: getPaginationMeta(total, page, limit) };
  }

  async listDeletedStudents(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const { search } = query;
    const where = {
      ...(tenantId && { tenantId }),
      deletedAt: { not: null },
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
        where, skip, take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          _count: {
            select: {
              applications: { where: { deletedAt: null } },
              documents: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);
    return { students, pagination: getPaginationMeta(total, page, limit) };
  }

  async getStudent(id, tenantId, userRole = null, userId = null) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), ...this._studentAccessScope(userRole, userId), deletedAt: null },
      include: {
        applications: {
          where: { deletedAt: null },
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
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        sourceAgent: true,
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        sourceUpdatedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            applications: { where: { deletedAt: null } },
            documents: { where: { deletedAt: null } },
            payments: true,
          },
        },
      },
    });
    if (!student) throw { statusCode: 404, message: 'Student not found' };
    return student;
  }

  async updateStudent(id, tenantId, data, userRole = null, userId = null) {
    const currentStudent = await this._assertExists(id, tenantId, userRole, userId);
    const studentData = this._cleanStudentData(data);
    const sourceWasProvided = Object.prototype.hasOwnProperty.call(data, 'sourceType') || Object.prototype.hasOwnProperty.call(data, 'sourceAgentId');
    if (sourceWasProvided) Object.assign(studentData, await this._validateSource(tenantId, data, true));
    if (Object.prototype.hasOwnProperty.call(data, 'assignedStaffId')) studentData.assignedStaffId = await this._validateAssignedStaff(tenantId, data.assignedStaffId);
    const duplicateChecks = this._getChangedDuplicateChecks(currentStudent, studentData);

    if (!duplicateChecks.passport) {
      studentData.passportNumberNormalized = currentStudent.passportNumberNormalized;
    }

    await this._assertNoDuplicate(tenantId, studentData, id, duplicateChecks);

    try {
      const updated = await prisma.student.update({
        where: { id },
        data: { ...studentData, ...(sourceWasProvided && { sourceUpdatedByUserId: userId, sourceUpdatedAt: new Date() }) },
      });
      if (sourceWasProvided && (currentStudent.sourceType !== updated.sourceType || currentStudent.sourceAgentId !== updated.sourceAgentId)) {
        await prisma.activityLog.create({ data: { tenantId, userId, action: 'SOURCE_UPDATE', entity: 'Student', entityId: id, oldValue: { sourceType: currentStudent.sourceType, sourceAgentId: currentStudent.sourceAgentId }, newValue: { sourceType: updated.sourceType, sourceAgentId: updated.sourceAgentId } } });
      }
      return updated;
    } catch (err) {
      this._handleUniqueConstraintError(err);
      throw err;
    }
  }

  async deleteStudent(id, tenantId, userRole = null, userId = null) {
    await this._assertExists(id, tenantId, userRole, userId);
    return prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, passportNumberNormalized: null },
    });
  }

  async restoreStudent(id, tenantId) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: { not: null } },
    });
    if (!student) throw { statusCode: 404, message: 'Deleted student not found' };

    const passportNumberNormalized = this._normalizePassportNumber(student.passportNumber);
    await this._assertNoDuplicate(student.tenantId, {
      passportNumberNormalized,
      email: student.email,
      phone: student.phone,
    }, student.id);

    return prisma.student.update({
      where: { id },
      data: { deletedAt: null, isActive: true, passportNumberNormalized },
    });
  }

  async permanentlyDeleteStudent(id, tenantId) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: { not: null } },
      include: {
        _count: { select: { applications: true, documents: true, payments: true, agentCommissions: true } },
      },
    });
    if (!student) throw { statusCode: 404, message: 'Deleted student not found' };
    const dependentCount = Object.values(student._count).reduce((sum, count) => sum + count, 0);
    if (dependentCount > 0) {
      throw {
        statusCode: 409,
        message: 'This student still has application, document, payment, or commission records. Remove those records first.',
      };
    }
    return prisma.student.delete({ where: { id } });
  }

  async transferStudent(id, tenantId, newOwnerId) {
    if (!newOwnerId || typeof newOwnerId !== 'string') {
      throw { statusCode: 400, message: 'A target owner is required' };
    }
    const student = await this._assertExists(id, tenantId);
    const ownerTenantId = tenantId || student.tenantId;

    const owner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        tenantId: ownerTenantId,
        isActive: true,
        deletedAt: null,
        role: { in: ['STAFF', 'TENANT_ADMIN'] },
      },
      select: { id: true },
    });
    if (!owner) {
      throw { statusCode: 400, message: 'Invalid owner - must be an active staff or admin in this tenant' };
    }

    return prisma.student.update({
      where: { id },
      data: { createdById: newOwnerId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  _studentAccessScope(userRole, userId) {
    if (userRole !== 'STAFF' || !userId) return {};

    return {
      OR: [
        { createdById: userId },
        { applications: { some: { agentId: userId, deletedAt: null } } },
      ],
    };
  }

  async _validateSource(tenantId, data, required) {
    const type = data.sourceType;
    if (!type && required) throw { statusCode: 400, message: 'Student Source is required', field: 'sourceType' };
    const shape = validateSourceShape(type, data.sourceAgentId);
    if (!shape.valid) throw { statusCode: 400, message: shape.message, field: type === 'DIRECT_STUDENT' ? 'sourceAgentId' : 'sourceType' };
    if (type === 'DIRECT_STUDENT') return { sourceType: type, sourceAgentId: null };
    const agent = await prisma.agent.findFirst({ where: { id: data.sourceAgentId, tenantId } });
    if (!agent) throw { statusCode: 400, message: 'Invalid Agent', field: 'sourceAgentId' };
    if (agent.status !== 'ACTIVE') throw { statusCode: 400, message: 'Selected Agent is not active', field: 'sourceAgentId' };
    if (agent.type !== type) throw { statusCode: 400, message: 'Agent category does not match Student Source', field: 'sourceAgentId' };
    return { sourceType: type, sourceAgentId: agent.id };
  }

  async _validateAssignedStaff(tenantId, id) {
    if (!id) return null;
    const user = await prisma.user.findFirst({ where: { id, tenantId, role: { in: ['STAFF','TENANT_ADMIN'] }, isActive: true, deletedAt: null } });
    if (!user) throw { statusCode: 400, message: 'Assigned internal staff is invalid', field: 'assignedStaffId' };
    return user.id;
  }

  async _assertExists(id, tenantId, userRole = null, userId = null) {
    const student = await prisma.student.findFirst({
      where: { id, ...(tenantId && { tenantId }), ...this._studentAccessScope(userRole, userId), deletedAt: null },
    });
    if (!student) throw { statusCode: 404, message: 'Student not found' };
    return student;
  }

  _cleanStudentData(data) {
    const passportNumber = this._normalizeOptionalText(data.passportNumber);
    const email = this._normalizeEmail(data.email);
    const phone = this._normalizeOptionalText(data.phone);

    return {
      fullName: this._normalizeOptionalText(data.fullName),
      passportNumber,
      passportNumberNormalized: this._normalizePassportNumber(passportNumber),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      nationality: data.nationality,
      phone,
      email,
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
      passport: data.passportNumberNormalized !== currentPassport,
      email: data.email !== currentEmail,
      phone: data.phone !== currentPhone,
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

  _normalizeEmail(value) {
    const trimmed = this._normalizeOptionalText(value);
    return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
  }

  _normalizePassportNumber(value) {
    const trimmed = this._normalizeOptionalText(value);
    return typeof trimmed === 'string' ? trimmed.toUpperCase().replace(/\s+/g, '') : undefined;
  }
}

module.exports = new StudentService();
