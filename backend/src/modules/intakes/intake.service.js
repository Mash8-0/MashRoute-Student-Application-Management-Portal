const prisma = require('../../config/database');

const TYPES = ['REGULAR', 'LATE_INTAKE', 'LATE_REGISTRATION', 'LATE_ARRIVAL', 'SPECIAL_INTAKE', 'MONTHLY', 'RESEARCH', 'ENGLISH', 'SHORT_COURSE'];
const STATUSES = ['DRAFT', 'UPCOMING', 'OPEN', 'CLOSING_SOON', 'CLOSED', 'FULL', 'COMPLETED', 'CANCELLED'];
const LATE_TYPES = new Set(['LATE_INTAKE', 'LATE_REGISTRATION', 'LATE_ARRIVAL', 'SPECIAL_INTAKE']);
const BLOCKED_STATUSES = new Set(['CLOSED', 'FULL', 'COMPLETED', 'CANCELLED']);

const badRequest = (message) => { throw { statusCode: 400, message }; };
const notFound = () => { throw { statusCode: 404, message: 'Intake not found' }; };
const toDate = (value, field, required = false) => {
  if (!value && !required) return null;
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) badRequest(`${field} must be a valid date`);
  return date;
};
const integer = (value, field, { min, max, nullable = true } = {}) => {
  if ((value === '' || value == null) && nullable) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (min != null && parsed < min) || (max != null && parsed > max)) badRequest(`${field} is invalid`);
  return parsed;
};
const snapshot = (intake) => intake && Object.fromEntries(Object.entries(intake).filter(([key]) => !['university', 'parentIntake', '_count', 'auditLogs'].includes(key)));

async function ensureUniversityAccess(tenantId, universityId) {
  const university = await prisma.university.findFirst({
    where: { id: universityId, isActive: true, OR: [{ tenantId }, { assignedTenants: { some: { id: tenantId } } }] },
  });
  if (!university) throw { statusCode: 403, message: 'University is not available to this tenant' };
  return university;
}

function inputData(body, existing = null) {
  const intakeType = body.intakeType ?? existing?.intakeType ?? 'REGULAR';
  const status = body.status ?? existing?.status ?? 'DRAFT';
  if (!TYPES.includes(intakeType)) badRequest('Invalid intake type');
  if (!STATUSES.includes(status)) badRequest('Invalid intake status');
  const data = {
    universityId: body.universityId ?? existing?.universityId,
    campusId: String(body.campusId ?? existing?.campusId ?? '').trim(),
    campusCode: body.campusCode === undefined ? existing?.campusCode : String(body.campusCode || '').trim() || null,
    campusName: body.campusName === undefined ? existing?.campusName : String(body.campusName || '').trim() || null,
    programmeId: String(body.programmeId ?? existing?.programmeId ?? '').trim(),
    programmeName: String(body.programmeName ?? existing?.programmeName ?? '').trim(),
    studyLevel: body.studyLevel === undefined ? existing?.studyLevel : String(body.studyLevel || '').trim() || null,
    intakeMonth: integer(body.intakeMonth ?? existing?.intakeMonth, 'intakeMonth', { min: 1, max: 12, nullable: false }),
    intakeYear: integer(body.intakeYear ?? existing?.intakeYear, 'intakeYear', { min: 2020, max: 2200, nullable: false }),
    intakeDate: toDate(body.intakeDate ?? existing?.intakeDate, 'intakeDate', true),
    applicationOpenDate: body.applicationOpenDate === undefined ? existing?.applicationOpenDate : toDate(body.applicationOpenDate, 'applicationOpenDate'),
    applicationDeadline: body.applicationDeadline === undefined ? existing?.applicationDeadline : toDate(body.applicationDeadline, 'applicationDeadline'),
    lateApplicationDeadline: body.lateApplicationDeadline === undefined ? existing?.lateApplicationDeadline : toDate(body.lateApplicationDeadline, 'lateApplicationDeadline'),
    internationalApplicationDeadline: body.internationalApplicationDeadline === undefined ? existing?.internationalApplicationDeadline : toDate(body.internationalApplicationDeadline, 'internationalApplicationDeadline'),
    arrivalDeadline: body.arrivalDeadline === undefined ? existing?.arrivalDeadline : toDate(body.arrivalDeadline, 'arrivalDeadline'),
    intakeType, status,
    isActive: body.isActive === undefined ? (existing?.isActive ?? true) : Boolean(body.isActive),
    isAvailableForInternationalStudents: body.isAvailableForInternationalStudents === undefined ? (existing?.isAvailableForInternationalStudents ?? true) : Boolean(body.isAvailableForInternationalStudents),
    maximumSeats: body.maximumSeats === undefined ? existing?.maximumSeats : integer(body.maximumSeats, 'maximumSeats', { min: 0 }),
    availableSeats: body.availableSeats === undefined ? existing?.availableSeats : integer(body.availableSeats, 'availableSeats', { min: 0 }),
    notes: body.notes === undefined ? existing?.notes : String(body.notes || '').trim() || null,
    parentIntakeId: body.parentIntakeId === undefined ? existing?.parentIntakeId : body.parentIntakeId || null,
  };
  if (!data.universityId || !data.campusId || !data.programmeId || !data.programmeName) badRequest('University, campus, programme, and programme name are required');
  if (data.applicationOpenDate && data.applicationDeadline && data.applicationOpenDate > data.applicationDeadline) badRequest('Application opening date must be before its deadline');
  if (data.internationalApplicationDeadline && data.internationalApplicationDeadline > data.intakeDate) badRequest('International deadline must be before the intake date');
  if (data.maximumSeats != null && data.availableSeats != null && data.availableSeats > data.maximumSeats) badRequest('Available seats cannot exceed maximum seats');
  if (LATE_TYPES.has(intakeType) && !data.parentIntakeId) badRequest('Late and special intakes must link to a regular parent intake');
  if (!LATE_TYPES.has(intakeType)) data.parentIntakeId = null;
  return data;
}

async function validateParent(tx, tenantId, data, id) {
  if (!data.parentIntakeId) return;
  if (data.parentIntakeId === id) badRequest('An intake cannot link to itself');
  const parent = await tx.intake.findFirst({ where: { id: data.parentIntakeId, tenantId, intakeType: 'REGULAR' } });
  if (!parent) badRequest('Parent intake must be a regular intake in the same tenant');
  if (parent.universityId !== data.universityId || parent.campusId !== data.campusId || parent.programmeId !== data.programmeId) {
    badRequest('Parent intake must match the same university, campus, and programme');
  }
}

async function list(tenantId, query, availableOnly = false, userId = null) {
  const where = { tenantId };
  for (const key of ['universityId', 'campusId', 'programmeId', 'intakeType', 'status']) if (query[key]) where[key] = query[key];
  if (query.intakeMonth) where.intakeMonth = integer(query.intakeMonth, 'intakeMonth', { min: 1, max: 12, nullable: false });
  if (query.intakeYear) where.intakeYear = integer(query.intakeYear, 'intakeYear', { min: 2020, max: 2200, nullable: false });
  if (query.search) where.OR = ['programmeName', 'campusName', 'notes'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } }));
  if (availableOnly) {
    const now = new Date();
    Object.assign(where, {
      isActive: true,
      isAvailableForInternationalStudents: true,
      status: { in: ['OPEN', 'CLOSING_SOON', 'UPCOMING'] },
      OR: [{ internationalApplicationDeadline: null }, { internationalApplicationDeadline: { gte: now } }],
      AND: [{ OR: [{ availableSeats: null }, { availableSeats: { gt: 0 } }] }],
    });
  }
  const rows = await prisma.intake.findMany({
    where,
    include: {
      university: { select: { id: true, name: true } },
      parentIntake: { select: { id: true, intakeMonth: true, intakeYear: true, intakeType: true } },
      _count: { select: { applications: { where: { deletedAt: null } } } },
    },
    orderBy: [{ intakeDate: 'asc' }, { programmeName: 'asc' }],
  });
  const setting = await prisma.intakeSetting.findUnique({ where: { tenantId } });
  const approvals = availableOnly && userId ? await prisma.lateIntakeApproval.findMany({
    where: { tenantId, requestedById: userId, status: 'APPROVED', intakeId: { in: rows.map((row) => row.id) } },
    orderBy: { reviewedAt: 'desc' }, select: { id: true, intakeId: true },
  }) : [];
  const approvalByIntake = new Map(approvals.map((approval) => [approval.intakeId, approval.id]));
  const leadDays = setting?.minimumInternationalLeadTimeDays ?? 75;
  return rows.map((row) => ({
    ...row,
    applicationCount: row._count.applications,
    requiresAdminApproval: LATE_TYPES.has(row.intakeType) || ((row.intakeDate.getTime() - Date.now()) / 86400000) < leadDays,
    minimumInternationalLeadTimeDays: leadDays,
    approvalId: approvalByIntake.get(row.id) || null,
  }));
}

async function create(tenantId, userId, body) {
  const data = inputData(body);
  await ensureUniversityAccess(tenantId, data.universityId);
  return prisma.$transaction(async (tx) => {
    await validateParent(tx, tenantId, data);
    const intake = await tx.intake.create({ data: { ...data, tenantId, createdById: userId, updatedById: userId } });
    await tx.intakeAuditLog.create({ data: { tenantId, intakeId: intake.id, userId, action: 'CREATE', newValue: snapshot(intake) } });
    return intake;
  });
}

async function update(id, tenantId, userId, body) {
  const existing = await prisma.intake.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();
  const data = inputData(body, existing);
  await ensureUniversityAccess(tenantId, data.universityId);
  return prisma.$transaction(async (tx) => {
    await validateParent(tx, tenantId, data, id);
    const intake = await tx.intake.update({ where: { id }, data: { ...data, updatedById: userId, archivedAt: data.isActive ? null : (existing.archivedAt || new Date()) } });
    await tx.intakeAuditLog.create({ data: { tenantId, intakeId: id, userId, action: 'UPDATE', oldValue: snapshot(existing), newValue: snapshot(intake) } });
    if (existing.status !== 'CANCELLED' && intake.status === 'CANCELLED') {
      const applicationCount = await tx.application.count({ where: { intakeId: id } });
      if (applicationCount > 0) {
        const admins = await tx.user.findMany({ where: { tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null }, select: { id: true } });
        await tx.notification.createMany({ data: admins.map(({ id: adminId }) => ({ tenantId, userId: adminId, type: 'SYSTEM', title: 'Intake cancelled with applications', message: `${intake.programmeName} was cancelled with ${applicationCount} attached application(s).`, metadata: { dedupeKey: `intake:${id}:cancelled`, intakeId: id } })) });
      }
    }
    return intake;
  });
}

async function setActive(id, tenantId, userId, isActive) {
  return update(id, tenantId, userId, { isActive });
}

async function bulkActive(tenantId, userId, ids, isActive) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) badRequest('Select between 1 and 200 intakes');
  return prisma.$transaction(async (tx) => {
    const rows = await tx.intake.findMany({ where: { tenantId, id: { in: ids } } });
    if (rows.length !== new Set(ids).size) throw { statusCode: 403, message: 'One or more intakes are outside this tenant' };
    const now = new Date();
    await tx.intake.updateMany({ where: { tenantId, id: { in: ids } }, data: { isActive: Boolean(isActive), archivedAt: isActive ? null : now, updatedById: userId } });
    await tx.intakeAuditLog.createMany({ data: rows.map((row) => ({ tenantId, intakeId: row.id, userId, action: isActive ? 'BULK_ACTIVATE' : 'BULK_DEACTIVATE', oldValue: snapshot(row), newValue: { isActive: Boolean(isActive) } })) });
    return { count: rows.length };
  });
}

async function duplicate(id, tenantId, userId, targetYear) {
  const source = await prisma.intake.findFirst({ where: { id, tenantId } });
  if (!source) notFound();
  const year = integer(targetYear, 'targetYear', { min: source.intakeYear + 1, max: 2200, nullable: false });
  const delta = year - source.intakeYear;
  const shift = (date) => date ? new Date(Date.UTC(date.getUTCFullYear() + delta, date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())) : null;
  return create(tenantId, userId, { ...snapshot(source), id: undefined, intakeYear: year, intakeDate: shift(source.intakeDate), applicationOpenDate: shift(source.applicationOpenDate), applicationDeadline: shift(source.applicationDeadline), lateApplicationDeadline: shift(source.lateApplicationDeadline), internationalApplicationDeadline: shift(source.internationalApplicationDeadline), arrivalDeadline: shift(source.arrivalDeadline), status: 'DRAFT', isActive: false, parentIntakeId: null });
}

async function audit(id, tenantId) {
  const exists = await prisma.intake.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!exists) notFound();
  return prisma.intakeAuditLog.findMany({ where: { intakeId: id, tenantId }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } });
}

async function requestApproval(tenantId, user, body) {
  const intake = await prisma.intake.findFirst({ where: { id: body.intakeId, tenantId, isActive: true } });
  if (!intake) notFound();
  if (!LATE_TYPES.has(intake.intakeType)) badRequest('This intake does not require late-intake approval');
  if (!String(body.internalReason || '').trim() || body.universityAcceptanceConfirmed !== true || body.visaRiskExplained !== true) badRequest('Reason and both confirmations are required');
  return prisma.$transaction(async (tx) => {
    const approval = await tx.lateIntakeApproval.create({ data: { tenantId, intakeId: intake.id, applicationId: body.applicationId || null, requestedById: user.id, internalReason: body.internalReason.trim(), universityAcceptanceConfirmed: true, visaRiskExplained: true } });
    const admins = await tx.user.findMany({ where: { tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null }, select: { id: true } });
    if (admins.length) await tx.notification.createMany({ data: admins.map((admin) => ({ tenantId, userId: admin.id, applicationId: body.applicationId || null, type: 'APPROVAL', title: 'Late intake approval required', message: `${intake.programmeName} requires late-intake approval`, metadata: { dedupeKey: `late-intake:${approval.id}`, approvalId: approval.id, intakeId: intake.id } })) });
    return approval;
  });
}

async function listApprovals(tenantId, status = 'PENDING') {
  if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) badRequest('Invalid approval status');
  return prisma.lateIntakeApproval.findMany({
    where: { tenantId, ...(status && { status }) },
    include: {
      intake: { select: { id: true, programmeName: true, campusName: true, intakeMonth: true, intakeYear: true, intakeType: true } },
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      application: { select: { id: true, referenceNo: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function reviewApproval(id, tenantId, userId, decision, reviewNotes) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) badRequest('Decision must be APPROVED or REJECTED');
  return prisma.$transaction(async (tx) => {
    const row = await tx.lateIntakeApproval.findFirst({ where: { id, tenantId, status: 'PENDING' } });
    if (!row) throw { statusCode: 404, message: 'Pending approval request not found' };
    const updated = await tx.lateIntakeApproval.update({ where: { id }, data: { status: decision, reviewedById: userId, reviewedAt: new Date(), reviewNotes: String(reviewNotes || '').trim() || null } });
    await tx.notification.create({ data: { tenantId, userId: row.requestedById, applicationId: row.applicationId, type: decision === 'APPROVED' ? 'APPROVAL' : 'REJECTION', title: `Late intake ${decision.toLowerCase()}`, message: reviewNotes || `Your late-intake request was ${decision.toLowerCase()}.`, metadata: { dedupeKey: `late-intake-review:${id}`, approvalId: id } } });
    return updated;
  });
}

async function getSetting(tenantId) {
  return prisma.intakeSetting.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
}
async function updateSetting(tenantId, days) {
  const value = integer(days, 'minimumInternationalLeadTimeDays', { min: 1, max: 365, nullable: false });
  return prisma.intakeSetting.upsert({ where: { tenantId }, create: { tenantId, minimumInternationalLeadTimeDays: value }, update: { minimumInternationalLeadTimeDays: value } });
}

module.exports = { list, create, update, setActive, bulkActive, duplicate, audit, requestApproval, listApprovals, reviewApproval, getSetting, updateSetting, TYPES, STATUSES, LATE_TYPES, BLOCKED_STATUSES };
