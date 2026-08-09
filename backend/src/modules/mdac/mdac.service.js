const path = require('path');
const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { uploadNamedDocument } = require('../../services/driveUpload');
const {
  addCalendarDays,
  computeMdacEligibility,
  partsInMalaysia,
  resolvePermanentState,
} = require('./mdacEligibility');
const { MDAC_TIMEZONE, MDAC_URL } = require('./mdac.constants');

const ACTION_FILTERS = new Set([
  'all',
  'not_yet_eligible',
  'eligible_now',
  'due_tomorrow',
  'due_today',
  'submitted',
  'submitted_unverified',
  'verified',
  'needs_review',
  'overdue',
  'not_required',
]);

function cleanString(value, max = 255) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function dateOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw { statusCode: 400, message: 'Invalid date value' };
  }
  return date;
}

function serializeMdac(application, currentDate = new Date()) {
  const permanentState = resolvePermanentState(application);
  return {
    required: application.mdacRequired,
    status: permanentState,
    submittedAt: application.mdacSubmittedAt,
    proofUrl: application.mdacProofUrl,
    proofDocumentId: application.mdacProofDocumentId,
    verifiedAt: application.mdacVerifiedAt,
    verifiedBy: application.mdacVerifiedBy,
    reviewNotes: application.mdacReviewNotes,
    previousArrivalDate: application.mdacPreviousArrivalDate,
    flightNumber: application.flightNumber,
    airline: application.airline,
    lastPortOfEmbarkation: application.lastPortOfEmbarkation,
    modeOfTravel: application.modeOfTravel,
    accommodationName: application.malaysiaAccommodationName,
    accommodationType: application.malaysiaAccommodationType,
    accommodationAddress: application.malaysiaAccommodationAddress,
    accommodationState: application.malaysiaAccommodationState,
    accommodationCity: application.malaysiaAccommodationCity,
    accommodationPostcode: application.malaysiaAccommodationPostcode,
    eligibility: computeMdacEligibility({
      arrivalDate: application.arrivalDate,
      currentDate,
      previousArrivalDate: application.mdacPreviousArrivalDate,
      mdacRequired: application.mdacRequired,
      mdacStatus: permanentState,
      timezone: application.arrivalTimezone || MDAC_TIMEZONE,
    }),
  };
}

class MdacService {
  async getEligibility(applicationId, tenantId, user) {
    const application = await this._getApplication(applicationId, tenantId, user);
    return serializeMdac(application);
  }

  async updateArrivalInfo(applicationId, tenantId, user, body = {}, file = null) {
    const application = await this._getApplication(applicationId, tenantId, user);
    if (!this._canEditArrival(user, application)) {
      throw { statusCode: 403, message: 'You are not allowed to update arrival information' };
    }

    const nextArrival = dateOrUndefined(body.arrivalDate);
    const data = {
      ...(body.flightDate !== undefined && { flightDate: dateOrUndefined(body.flightDate) || null }),
      ...(body.arrivalDate !== undefined && { arrivalDate: nextArrival || null }),
      ...(body.arrivalTimezone !== undefined && { arrivalTimezone: cleanString(body.arrivalTimezone, 80) || MDAC_TIMEZONE }),
      ...(body.flightNumber !== undefined && { flightNumber: cleanString(body.flightNumber, 80) }),
      ...(body.airline !== undefined && { airline: cleanString(body.airline, 120) }),
      ...(body.lastPortOfEmbarkation !== undefined && { lastPortOfEmbarkation: cleanString(body.lastPortOfEmbarkation, 120) }),
      ...(body.modeOfTravel !== undefined && { modeOfTravel: cleanString(body.modeOfTravel, 80) }),
      ...(body.accommodationName !== undefined && { malaysiaAccommodationName: cleanString(body.accommodationName, 160) }),
      ...(body.accommodationType !== undefined && { malaysiaAccommodationType: cleanString(body.accommodationType, 80) }),
      ...(body.accommodationAddress !== undefined && { malaysiaAccommodationAddress: cleanString(body.accommodationAddress, 500) }),
      ...(body.accommodationState !== undefined && { malaysiaAccommodationState: cleanString(body.accommodationState, 120) }),
      ...(body.accommodationCity !== undefined && { malaysiaAccommodationCity: cleanString(body.accommodationCity, 120) }),
      ...(body.accommodationPostcode !== undefined && { malaysiaAccommodationPostcode: cleanString(body.accommodationPostcode, 20) }),
    };

    if (file) {
      const upload = await this._uploadWorkflowDocument(application, file, 'Flight Ticket');
      data.flightTicketUrl = upload.fileUrl;
    }

    const arrivalChanged = body.arrivalDate !== undefined
      && application.arrivalDate
      && nextArrival
      && computeMdacEligibility({ arrivalDate: application.arrivalDate }).arrivalDate
        !== computeMdacEligibility({ arrivalDate: nextArrival }).arrivalDate;

    if (arrivalChanged) {
      data.mdacPreviousArrivalDate = application.arrivalDate;
      if (['SUBMITTED', 'VERIFIED'].includes(resolvePermanentState(application))) {
        data.mdacStatus = 'NEEDS_REVIEW';
        data.mdacReviewNotes = 'Malaysia arrival date changed after MDAC submission or verification. Review the existing MDAC proof.';
      }
    } else if (body.arrivalDate !== undefined && !application.mdacStatus) {
      data.mdacStatus = 'REQUIRED';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data,
        include: this._include(),
      });
      await this._activity(tx, tenantId, user.id, applicationId, arrivalChanged ? 'MDAC_ARRIVAL_CHANGED' : 'MDAC_ARRIVAL_UPDATED', {
        oldArrivalDate: application.arrivalDate,
        newArrivalDate: row.arrivalDate,
      });
      return row;
    });

    if (arrivalChanged) await this._notifyArrivalChanged(updated, application.arrivalDate);
    return updated;
  }

  async markNotRequired(applicationId, tenantId, user, notes) {
    const application = await this._getApplication(applicationId, tenantId, user);
    if (!['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw { statusCode: 403, message: 'Only admin can mark MDAC as not required' };
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: {
          mdacRequired: false,
          mdacStatus: 'NOT_REQUIRED',
          mdacReviewNotes: cleanString(notes, 1000),
        },
        include: this._include(),
      });
      await this._activity(tx, tenantId, user.id, applicationId, 'MDAC_NOT_REQUIRED', { notes });
      return row;
    });
    return updated;
  }

  async markSubmitted(applicationId, tenantId, user, notes) {
    const application = await this._getApplication(applicationId, tenantId, user);
    if (!this._canEditArrival(user, application)) {
      throw { statusCode: 403, message: 'You are not allowed to submit MDAC' };
    }
    if (application.mdacRequired === false) {
      throw { statusCode: 400, message: 'MDAC is marked as not required' };
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: {
          mdacStatus: 'SUBMITTED',
          mdacSubmittedAt: new Date(),
          mdacReviewNotes: cleanString(notes, 1000),
        },
        include: this._include(),
      });
      await this._activity(tx, tenantId, user.id, applicationId, 'MDAC_SUBMITTED', { notes });
      return row;
    });
    await this._notifyReviewers(updated, 'MDAC Proof Submitted', `${updated.referenceNo} has MDAC proof waiting for review.`, 'mdac_proof_submitted');
    return updated;
  }

  async uploadProof(applicationId, tenantId, user, file, notes) {
    if (!file) throw { statusCode: 400, message: 'MDAC proof file is required' };
    const application = await this._getApplication(applicationId, tenantId, user);
    if (!this._canEditArrival(user, application)) {
      throw { statusCode: 403, message: 'You are not allowed to upload MDAC proof' };
    }
    const upload = await this._uploadWorkflowDocument(application, file, 'MDAC Confirmation');
    const updated = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId,
          studentId: application.studentId,
          applicationId,
          uploadedById: user.id,
          type: 'MDAC_CONFIRMATION',
          status: 'UPLOADED',
          originalName: file.originalname,
          fileName: file.filename || path.basename(file.path),
          fileUrl: upload.fileUrl,
          driveViewLink: upload.viewUrl || null,
          fileSource: upload.driveFileId ? 'google_drive' : 'local',
          driveFolderId: upload.driveFolderId || null,
          publicId: upload.driveFileId || null,
          fileSize: file.size,
          mimeType: file.mimetype,
          notes: cleanString(notes, 1000) || 'MDAC confirmation proof',
          documentStage: 'MDAC',
        },
      });
      const row = await tx.application.update({
        where: { id: applicationId },
        data: {
          mdacRequired: true,
          mdacStatus: 'SUBMITTED',
          mdacSubmittedAt: new Date(),
          mdacProofUrl: upload.fileUrl,
          mdacProofDocumentId: document.id,
          mdacVerifiedAt: null,
          mdacVerifiedById: null,
          mdacReviewNotes: cleanString(notes, 1000),
        },
        include: this._include(),
      });
      await this._activity(tx, tenantId, user.id, applicationId, 'MDAC_PROOF_UPLOADED', { documentId: document.id });
      return row;
    });
    await this._notifyReviewers(updated, 'MDAC Proof Uploaded', `${updated.referenceNo} has MDAC proof waiting for verification.`, 'mdac_proof_uploaded');
    return updated;
  }

  async verify(applicationId, tenantId, user, { action = 'verify', notes } = {}) {
    const application = await this._getApplication(applicationId, tenantId, user);
    if (!['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw { statusCode: 403, message: 'Only admin can verify MDAC proof' };
    }
    if (action !== 'review' && !application.mdacProofUrl && !application.mdacSubmittedAt) {
      throw { statusCode: 400, message: 'MDAC must be submitted before verification' };
    }
    const status = action === 'review' ? 'NEEDS_REVIEW' : 'VERIFIED';
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.application.update({
        where: { id: applicationId },
        data: {
          mdacRequired: true,
          mdacStatus: status,
          mdacVerifiedAt: status === 'VERIFIED' ? new Date() : null,
          mdacVerifiedById: status === 'VERIFIED' ? user.id : null,
          mdacReviewNotes: cleanString(notes, 1000),
        },
        include: this._include(),
      });
      await this._activity(tx, tenantId, user.id, applicationId, status === 'VERIFIED' ? 'MDAC_VERIFIED' : 'MDAC_NEEDS_REVIEW', { notes });
      return row;
    });
    await this._notifyAssignee(updated, status === 'VERIFIED' ? 'MDAC Verified' : 'MDAC Needs Review', `${updated.referenceNo} MDAC status is ${status.replace(/_/g, ' ').toLowerCase()}.`, status === 'VERIFIED' ? 'mdac_verified' : 'mdac_needs_review');
    return updated;
  }

  async listActionRequired(tenantId, query = {}, user) {
    const { page, limit, skip } = getPagination(query);
    const filter = ACTION_FILTERS.has(String(query.mdac || 'all')) ? String(query.mdac || 'all') : 'all';
    const where = {
      ...(tenantId && { tenantId }),
      deletedAt: null,
      arrivalDate: { not: null },
      ...(user.role === 'STAFF' && { agentId: user.id }),
    };
    const rows = await prisma.application.findMany({
      where,
      orderBy: { arrivalDate: 'asc' },
      include: this._include(),
    });
    const mapped = rows.map((row) => ({ ...row, mdac: serializeMdac(row) }));
    const filtered = mapped.filter((row) => this._matchesFilter(row.mdac, filter));
    return {
      applications: filtered.slice(skip, skip + limit),
      pagination: getPaginationMeta(filtered.length, page, limit),
    };
  }

  async dashboardCounts(tenantId, user) {
    const today = partsInMalaysia(new Date());
    const tomorrow = addCalendarDays(today, 1);
    const windowStartCutoff = addCalendarDays(today, 2);
    const scopedUserId = user.role === 'STAFF' ? user.id : null;
    const rows = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND "mdacStatus" = 'REQUIRED'::"MdacStatus"
            AND ("arrivalDate" AT TIME ZONE 'Asia/Kuala_Lumpur')::date > ${tomorrow.isoDate}::date
            AND ("arrivalDate" AT TIME ZONE 'Asia/Kuala_Lumpur')::date <= ${windowStartCutoff.isoDate}::date
        )::int AS "eligibleNow",
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND "mdacStatus" = 'REQUIRED'::"MdacStatus"
            AND ("arrivalDate" AT TIME ZONE 'Asia/Kuala_Lumpur')::date = ${tomorrow.isoDate}::date
        )::int AS "dueTomorrow",
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND "mdacStatus" = 'REQUIRED'::"MdacStatus"
            AND ("arrivalDate" AT TIME ZONE 'Asia/Kuala_Lumpur')::date = ${today.isoDate}::date
        )::int AS "dueToday",
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND "mdacStatus" = 'SUBMITTED'::"MdacStatus"
        )::int AS "submittedUnverified",
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND (
              "mdacStatus" = 'NEEDS_REVIEW'::"MdacStatus"
              OR ("mdacPreviousArrivalDate" IS NOT NULL AND "mdacStatus" IN ('SUBMITTED'::"MdacStatus", 'VERIFIED'::"MdacStatus"))
            )
        )::int AS "needsReview",
        COUNT(*) FILTER (
          WHERE "mdacRequired" = true
            AND "mdacStatus" IN ('REQUIRED'::"MdacStatus", 'NEEDS_REVIEW'::"MdacStatus")
            AND ("arrivalDate" AT TIME ZONE 'Asia/Kuala_Lumpur')::date < ${today.isoDate}::date
        )::int AS "overdue"
      FROM "Application"
      WHERE "deletedAt" IS NULL
        AND "arrivalDate" IS NOT NULL
        AND (${tenantId}::text IS NULL OR "tenantId" = ${tenantId})
        AND (${scopedUserId}::text IS NULL OR "agentId" = ${scopedUserId})
    `;
    return rows[0] || { eligibleNow: 0, dueTomorrow: 0, dueToday: 0, submittedUnverified: 0, needsReview: 0, overdue: 0 };
  }

  async runDailyReminders({ now = new Date(), dryRun = false } = {}) {
    if (process.env.NODE_ENV === 'test') return { scanned: 0, sent: 0 };
    const rows = await prisma.application.findMany({
      where: {
        deletedAt: null,
        arrivalDate: { not: null },
        mdacRequired: true,
        mdacStatus: { in: ['REQUIRED', 'NEEDS_REVIEW'] },
      },
      include: this._include(),
    });
    let sent = 0;
    for (const app of rows) {
      const mdac = serializeMdac(app, now);
      const state = mdac.eligibility.displayState;
      const dateKey = mdac.eligibility.todayDate;
      let type = null;
      let title = null;
      let message = null;
      if (mdac.eligibility.daysUntilArrival === 7) {
        type = 'mdac_available_soon';
        title = 'MDAC will become available soon';
        message = `${app.referenceNo} arrives in Malaysia on ${mdac.eligibility.deadlineDate}.`;
      } else if (state === 'ELIGIBLE_NOW') {
        type = 'mdac_window_open';
        title = 'MDAC can now be submitted';
        message = `${app.referenceNo} is inside the MDAC submission window.`;
      } else if (state === 'DUE_TOMORROW') {
        type = 'mdac_due_tomorrow';
        title = 'MDAC due tomorrow';
        message = `${app.referenceNo} MDAC should be submitted urgently.`;
      } else if (state === 'DUE_TODAY') {
        type = 'mdac_due_today';
        title = 'MDAC due today';
        message = `${app.referenceNo} arrives in Malaysia today.`;
      } else if (state === 'OVERDUE') {
        type = 'mdac_overdue';
        title = 'MDAC overdue';
        message = `${app.referenceNo} arrival date has passed without verified MDAC.`;
      }
      if (type && !dryRun) {
        sent += await this._notifyAssignee(app, title, message, type, dateKey);
        sent += await this._notifyAdmins(app, title, message, type, dateKey);
      }
    }
    return { scanned: rows.length, sent };
  }

  _matchesFilter(mdac, filter) {
    if (filter === 'all') return true;
    const state = mdac.eligibility.displayState;
    if (filter === 'not_yet_eligible') return state === 'NOT_YET_ELIGIBLE';
    if (filter === 'eligible_now') return state === 'ELIGIBLE_NOW';
    if (filter === 'due_tomorrow') return state === 'DUE_TOMORROW';
    if (filter === 'due_today') return state === 'DUE_TODAY';
    if (filter === 'submitted') return mdac.status === 'SUBMITTED';
    if (filter === 'submitted_unverified') return mdac.status === 'SUBMITTED';
    if (filter === 'verified') return mdac.status === 'VERIFIED';
    if (filter === 'needs_review') return state === 'NEEDS_REVIEW' || state === 'ARRIVAL_DATE_CHANGED';
    if (filter === 'overdue') return state === 'OVERDUE';
    if (filter === 'not_required') return mdac.status === 'NOT_REQUIRED';
    return true;
  }

  _canEditArrival(user, application) {
    if (['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;
    return user.role === 'STAFF' && application.agentId === user.id;
  }

  async _getApplication(id, tenantId, user) {
    const where = { id, ...(tenantId && { tenantId }), deletedAt: null };
    if (user.role === 'STAFF') where.agentId = user.id;
    const application = await prisma.application.findFirst({ where, include: this._include() });
    if (!application) throw { statusCode: 404, message: 'Application not found' };
    return application;
  }

  async _uploadWorkflowDocument(application, file, label) {
    const student = application.student || await prisma.student.findUnique({ where: { id: application.studentId } });
    const passport = (student?.passportNumber || 'NOPASS').trim().toUpperCase();
    const name = (student?.fullName || 'STUDENT').trim().toUpperCase();
    const date = new Date().toISOString().slice(0, 10);
    const folderName = `MRSM-${passport} ${name}`;
    const upload = await uploadNamedDocument(file, `${label} ${passport} ${name} ${date}`, folderName, student?.driveFolderId || null);
    if (upload.driveFolderId && upload.driveFolderId !== student?.driveFolderId) {
      await prisma.student.update({
        where: { id: application.studentId },
        data: { driveFolderId: upload.driveFolderId, driveFolderName: folderName },
      }).catch(() => {});
    }
    return upload;
  }

  async _activity(tx, tenantId, userId, applicationId, action, newValue) {
    return tx.activityLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity: 'Application',
        entityId: applicationId,
        newValue: newValue || undefined,
      },
    });
  }

  async _notifyArrivalChanged(application, oldArrivalDate) {
    const dateKey = `${oldArrivalDate?.toISOString?.() || oldArrivalDate}->${application.arrivalDate?.toISOString?.() || application.arrivalDate}`;
    await this._notifyAssignee(application, 'Malaysia arrival date changed', `${application.referenceNo} arrival date changed. Review MDAC status.`, 'mdac_arrival_changed', dateKey);
    await this._notifyAdmins(application, 'Malaysia arrival date changed', `${application.referenceNo} arrival date changed. MDAC may need review.`, 'mdac_arrival_changed', dateKey);
  }

  async _notifyReviewers(application, title, message, type) {
    return this._notifyAdmins(application, title, message, type);
  }

  async _notifyAssignee(application, title, message, type, dateKey = 'state') {
    if (!application.agentId) return 0;
    return this._createNotification(application, application.agentId, title, message, type, dateKey);
  }

  async _notifyAdmins(application, title, message, type, dateKey = 'state') {
    const admins = await prisma.user.findMany({
      where: { tenantId: application.tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null },
      select: { id: true },
    });
    let count = 0;
    for (const admin of admins) count += await this._createNotification(application, admin.id, title, message, type, dateKey);
    return count;
  }

  async _createNotification(application, userId, title, message, type, dateKey) {
    const idempotencyKey = `mdac:${application.id}:${type}:${dateKey}`;
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        applicationId: application.id,
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { id: true },
    });
    if (existing) return 0;
    await prisma.notification.create({
      data: {
        tenantId: application.tenantId,
        userId,
        applicationId: application.id,
        type: 'SYSTEM',
        title,
        message,
        metadata: { idempotencyKey, mdacType: type, officialUrl: MDAC_URL },
      },
    });
    return 1;
  }

  _include() {
    return {
      student: { select: { id: true, fullName: true, passportNumber: true, email: true, phone: true, driveFolderId: true } },
      university: { select: { id: true, name: true, country: true } },
      agent: { select: { id: true, firstName: true, lastName: true, email: true } },
      mdacVerifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    };
  }
}

module.exports = new MdacService();
module.exports.serializeMdac = serializeMdac;
