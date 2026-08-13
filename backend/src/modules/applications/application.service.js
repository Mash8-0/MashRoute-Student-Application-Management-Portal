const path = require('path');
const fs = require('fs').promises;
const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { generateReferenceNo } = require('../../utils/generateReference');
const whatsapp = require('../../services/whatsappNotify');
const emailNotify = require('../../services/emailNotify');
const documentService = require('../documents/document.service');

// Pre-EMGS progress milestones
const STATUS_PROGRESS = {
  DRAFT: 0, SUBMITTED: 0, ACCEPTED: 10,
  AWAITING_VERIFICATION: 20, SENT_TO_UNIVERSITY: 30,
  AWAITING_OFFER_LETTER: 40, OFFER_LETTER_ISSUED: 50,
  EMGS_PROCESSING: 55, COMPLETED: 100, REJECTED: 0,
  // Legacy
  LOE_PROCESSING: 20, LOE_APPROVED: 40, PAYMENT_PENDING: 40,
  EMGS_SUBMITTED: 50, EMGS_APPROVED: 65, EVAL_APPROVED: 75,
  VISA_APPROVED: 85, AIRPORT_CLEARANCE: 95,
};

// Ordered sequence for sequential validation
const ORDERED_STATUSES = [
  'SUBMITTED', 'ACCEPTED', 'AWAITING_VERIFICATION',
  'SENT_TO_UNIVERSITY', 'AWAITING_OFFER_LETTER',
  'OFFER_LETTER_ISSUED', 'EMGS_PROCESSING', 'COMPLETED',
];

// Statuses allowed via the /status PATCH endpoint (excludes accept, emgs, invoice transitions)
const UPDATABLE_STATUSES = [
  'AWAITING_VERIFICATION', 'SENT_TO_UNIVERSITY',
  'AWAITING_OFFER_LETTER', 'OFFER_LETTER_ISSUED', 'REJECTED',
];

// Valid EMGS percentage steps
// EMGS percentage milestones. The post-eVAL stages (Awaiting eVisa → eVisa
// Approved → Under Arrival) are NOT percentages — they live on `postEvalStatus`.
const EMGS_STEPS = [0, 5, 10, 15, 32, 35, 70, 80, 90, 100];

// Post-eVAL workflow states (separate from the EMGS percentage).
const POST_EVAL_STATUSES = ['AWAITING_EVISA', 'EVISA_APPROVED', 'UNDER_ARRIVAL', 'ARRIVAL_COMPLETED'];
const ENGLISH_PROFICIENCY_OPTIONS = ['IELTS', 'PTE', 'MOI', 'NONE'];
const INTAKE_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function resolveApplicationIntake(tenantId, intakeId, { requireAvailable = false } = {}) {
  if (!intakeId) return null;
  const intake = await prisma.intake.findFirst({
    where: {
      id: intakeId,
      tenantId,
      ...(requireAvailable && {
        isActive: true,
        isAvailableForInternationalStudents: true,
        status: { in: ['OPEN', 'CLOSING_SOON', 'UPCOMING'] },
      }),
    },
  });
  if (!intake) throw { statusCode: 400, message: 'Selected intake is not available' };
  if (requireAvailable && intake.internationalApplicationDeadline && intake.internationalApplicationDeadline < new Date()) {
    throw { statusCode: 400, message: 'Selected intake application deadline has passed' };
  }
  if (requireAvailable && intake.availableSeats === 0) {
    throw { statusCode: 400, message: 'Selected intake has no available seats' };
  }
  return {
    universityId: intake.universityId,
    campusId: intake.campusId,
    campusCode: intake.campusCode,
    campus: intake.campusName || intake.campusCode,
    programmeId: intake.programmeId,
    program: intake.programmeName,
    intakeId: intake.id,
    intake: `${INTAKE_MONTHS[intake.intakeMonth - 1]} ${intake.intakeYear}`,
    legacyIntake: `${INTAKE_MONTHS[intake.intakeMonth - 1]} ${intake.intakeYear}`,
    intakeYear: intake.intakeYear,
  };
}

async function resolveLegacyAcademicSelection(tenantId, data) {
  if (!data.universityId) return {};
  const university = await prisma.university.findFirst({
    where: {
      id: data.universityId,
      isActive: true,
      OR: [{ tenantId }, { assignedTenants: { some: { id: tenantId } } }],
    },
    select: { id: true, city: true, courses: true, intakes: true },
  });
  if (!university) throw { statusCode: 400, message: 'Selected university is not available' };

  const courses = Array.isArray(university.courses) ? university.courses : [];
  if (!courses.length) return { universityId: university.id };
  const course = courses.find((row) => row?.name === data.program);
  if (!course) throw { statusCode: 400, message: 'Selected course is not available at this university' };

  const campusCode = String(data.campusCode || data.campusId || '').split(':').at(-1) || '';
  const codes = Array.isArray(course.campusCodes) ? course.campusCodes : [];
  const names = Array.isArray(course.campuses) ? course.campuses : [];
  const allowedCodes = codes.length ? codes : (names.length ? names : ['MAIN']);
  if (!campusCode || !allowedCodes.includes(campusCode)) {
    throw { statusCode: 400, message: 'Selected course is not available at this campus' };
  }
  const campusIndex = allowedCodes.indexOf(campusCode);
  const campusName = names[campusIndex] || data.campus || (campusCode === 'MAIN' ? university.city || 'Main Campus' : campusCode);

  const configuredIntakes = Array.isArray(university.intakes) ? university.intakes : [];
  if (configuredIntakes.length && data.intake && !configuredIntakes.includes(data.intake)) {
    throw { statusCode: 400, message: 'Selected intake is not available at this university' };
  }
  return {
    universityId: university.id,
    campusId: `${university.id}:${campusCode}`,
    campusCode,
    campus: campusName,
    programmeId: data.programmeId || `${university.id}:${course.name}`,
    program: course.name,
  };
}

function normalizeEnglishProficiency(value) {
  const normalized = String(value || 'NONE').trim().toUpperCase().replace(/NOT_AVAILABLE|NOT AVAILABLE|N\/A/g, 'NONE');
  if (!ENGLISH_PROFICIENCY_OPTIONS.includes(normalized)) {
    throw { statusCode: 400, message: 'Invalid English Proficiency option' };
  }
  return normalized;
}

class ApplicationService {
  // ─── Create ───────────────────────────────────────────────────────────────

  async createApplication(tenantId, userId, data, io) {
    const referenceNo = generateReferenceNo('MR');
    const intakeData = await resolveApplicationIntake(tenantId, data.intakeId, { requireAvailable: true });
    const academicData = intakeData || await resolveLegacyAcademicSelection(tenantId, data);
    if (data.universityId && !intakeData) {
      const configuredIntakeCount = await prisma.intake.count({
        where: {
          tenantId,
          universityId: data.universityId,
          isActive: true,
          isAvailableForInternationalStudents: true,
          status: { in: ['OPEN', 'CLOSING_SOON', 'UPCOMING'] },
        },
      });
      if (configuredIntakeCount > 0) {
        throw { statusCode: 400, message: 'Campus, course, and intake selection is required for this university' };
      }
    }

    const application = await prisma.application.create({
      data: {
        tenantId, studentId: data.studentId, universityId: academicData.universityId || data.universityId,
        agentId: data.agentId || userId, createdById: userId, referenceNo,
        program: data.program, intake: data.intake,
        intakeYear: data.intakeYear ? parseInt(data.intakeYear) : null,
        ...academicData,
        country: data.country,
        englishProficiency: normalizeEnglishProficiency(data.englishProficiency),
        priority: data.priority || 'MEDIUM',
        status: 'SUBMITTED', progressPct: 0,
      },
      include: this._baseInclude(),
    });

    await this._recordStatusHistory(application.id, userId, null, 'SUBMITTED', 'Application submitted');

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:created', {
        id: application.id, referenceNo: application.referenceNo,
        studentName: application.student?.fullName, status: 'SUBMITTED',
      });
    }

    whatsapp.notify('application_created', application);

    return application;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async listApplications(tenantId, query, userId, userRole) {
    const { page, limit, skip } = getPagination(query);
    const { search, status, agentId, universityId, priority, intake, country, studentId } = query;

    const where = {
      // SUPER_ADMIN has tenantId null → omit filter to see all tenants
      ...(tenantId && { tenantId }),
      deletedAt: null,
      ...(status && { status }),
      ...(agentId && { agentId }),
      ...(universityId && { universityId }),
      ...(priority && { priority }),
      ...(intake && { intake }),
      ...(country && { country }),
      ...(studentId && { studentId }),
      ...(userRole === 'STAFF' && { agentId: userId }),
      ...(search && {
        OR: [
          { referenceNo: { contains: search, mode: 'insensitive' } },
          { program: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
          { student: { passportNumber: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: this._listInclude(),
      }),
      prisma.application.count({ where }),
    ]);

    return { applications, pagination: getPaginationMeta(total, page, limit) };
  }

  async listDeletedApplications(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const { search } = query;
    const where = {
      ...(tenantId && { tenantId }),
      deletedAt: { not: null },
      ...(search && {
        OR: [
          { referenceNo: { contains: search, mode: 'insensitive' } },
          { program: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
          { student: { passportNumber: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where, skip, take: limit,
        orderBy: { deletedAt: 'desc' },
        include: this._listInclude(),
      }),
      prisma.application.count({ where }),
    ]);
    return { applications, pagination: getPaginationMeta(total, page, limit) };
  }

  // ─── Get ──────────────────────────────────────────────────────────────────

  async getApplication(id, tenantId, userId, userRole) {
    const where = { id, ...(tenantId && { tenantId }), deletedAt: null };
    if (userRole === 'STAFF') where.agentId = userId;

    const application = await prisma.application.findFirst({
      where, include: this._detailInclude(),
    });
    if (!application) throw { statusCode: 404, message: 'Application not found' };
    return application;
  }

  // ─── Update basic fields ───────────────────────────────────────────────────

  async updateApplication(id, tenantId, data) {
    await this._assertExists(id, tenantId);
    const updateData = {};
    const hasField = (field) => Object.prototype.hasOwnProperty.call(data, field);

    if (hasField('intakeId') && data.intakeId) {
      Object.assign(updateData, await resolveApplicationIntake(tenantId, data.intakeId));
    } else if (hasField('universityId') || hasField('program') || hasField('campusId')) {
      Object.assign(updateData, await resolveLegacyAcademicSelection(tenantId, data));
    }

    if (hasField('universityId') && !updateData.intakeId) updateData.universityId = data.universityId || null;
    if (hasField('agentId')) updateData.agentId = data.agentId || null;
    if (hasField('program') && !updateData.intakeId) updateData.program = data.program;
    if (hasField('intake') && !updateData.intakeId) updateData.intake = data.intake;
    if (hasField('intakeYear') && !updateData.intakeId) updateData.intakeYear = data.intakeYear ? parseInt(data.intakeYear) : null;
    if (hasField('country')) updateData.country = data.country;
    if (hasField('englishProficiency')) {
      updateData.englishProficiency = normalizeEnglishProficiency(data.englishProficiency);
    }
    if (hasField('priority')) updateData.priority = data.priority;
    if (hasField('rejectionReason')) updateData.rejectionReason = data.rejectionReason;

    return prisma.application.update({
      where: { id },
      data: updateData,
      include: this._baseInclude(),
    });
  }

  // ─── Accept application (TENANT_ADMIN only) ────────────────────────────────

  async acceptApplication(id, tenantId, userId, userRole, notes, io) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can accept applications' };
    }

    const application = await this._assertExists(id, tenantId);

    if (application.isAccepted) {
      throw { statusCode: 400, message: 'Application is already accepted' };
    }
    if (application.status === 'COMPLETED' || application.status === 'REJECTED') {
      throw { statusCode: 400, message: 'Cannot accept a completed or rejected application' };
    }

    const oldStatus = application.status;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        isAccepted: true,
        acceptedById: userId,
        acceptedAt: new Date(),
        status: 'ACCEPTED',
        progressPct: STATUS_PROGRESS['ACCEPTED'],
      },
      include: this._baseInclude(),
    });

    await this._recordStatusHistory(id, userId, oldStatus, 'ACCEPTED', notes || 'Application accepted by admin');

    await this._notifyAgent(application, tenantId, id, 'APPROVAL', 'Application Accepted',
      `${application.referenceNo} has been accepted`, io);

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:statusChanged', {
        id, referenceNo: application.referenceNo,
        oldStatus, newStatus: 'ACCEPTED',
        progressPct: STATUS_PROGRESS['ACCEPTED'],
        changedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  // ─── Update status (admin; forward sequential, backward unrestricted) ────

  isStatusTransitionAllowed(oldStatus, newStatus) {
    if (newStatus === 'REJECTED' || oldStatus === 'REJECTED') return true;
    const currentIdx = ORDERED_STATUSES.indexOf(oldStatus);
    const newIdx = ORDERED_STATUSES.indexOf(newStatus);
    if (currentIdx < 0 || newIdx < 0) return false;
    // Admins may return to any earlier workflow stage, but forward movement
    // must still advance exactly one stage at a time.
    return newIdx <= currentIdx + 1;
  }

  async updateStatus(id, tenantId, userId, userRole, newStatus, notes, io) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can update application status' };
    }

    const application = await this._assertExists(id, tenantId);
    const oldStatus = application.status;

    if (oldStatus === newStatus) throw { statusCode: 400, message: 'Already in this status' };

    if (!UPDATABLE_STATUSES.includes(newStatus)) {
      throw { statusCode: 400, message: `Status "${newStatus}" cannot be set via this endpoint` };
    }

    // Must be accepted before any forward movement
    if (!application.isAccepted && newStatus !== 'REJECTED') {
      throw { statusCode: 400, message: 'Application must be accepted before status can be updated' };
    }

    if (!this.isStatusTransitionAllowed(oldStatus, newStatus)) {
      throw {
        statusCode: 400,
        message: `Invalid forward transition: "${oldStatus}" → "${newStatus}". Forward updates must follow the workflow sequence.`,
      };
    }

    const progressPct = STATUS_PROGRESS[newStatus] ?? application.progressPct;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: newStatus, progressPct,
        ...(newStatus === 'COMPLETED' && { completedAt: new Date() }),
        ...(oldStatus === 'COMPLETED' && newStatus !== 'COMPLETED' && { completedAt: null }),
      },
      include: this._baseInclude(),
    });

    await this._recordStatusHistory(id, userId, oldStatus, newStatus, notes);
    await this._notifyAgent(application, tenantId, id, 'STATUS_CHANGED', 'Application Status Updated',
      `${application.referenceNo} moved to ${newStatus.replace(/_/g, ' ')}`, io);
    whatsapp.notify('application_status_updated', updated, {
      status: newStatus.replace(/_/g, ' '),
    });
    // OFFER_LETTER_ISSUED is only a workflow stage. Send its email after the
    // actual document upload so the offer letter can be attached.
    if (newStatus !== 'OFFER_LETTER_ISSUED') {
      emailNotify.notify('application_status_updated', updated, {
        status: newStatus.replace(/_/g, ' '),
        notifyTenantAdmin: ['REJECTED', 'COMPLETED'].includes(newStatus),
      });
    }
    if (newStatus === 'COMPLETED') {
      emailNotify.notify('application_successful', updated);
    }

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:statusChanged', {
        id, referenceNo: application.referenceNo,
        oldStatus, newStatus, progressPct,
        changedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  // ─── Upload Offer Letter (TENANT_ADMIN only) ───────────────────────────────

  async uploadOfferLetter(id, tenantId, userId, userRole, file) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can upload the Offer Letter' };
    }

    const application = await this._assertExists(id, tenantId);

    if (!['AWAITING_OFFER_LETTER', 'OFFER_LETTER_ISSUED'].includes(application.status)) {
      throw { statusCode: 400, message: 'Offer Letter can only be uploaded when awaiting or issuing the Offer Letter' };
    }

    if (file.mimetype !== 'application/pdf' || path.extname(file.originalname || '').toLowerCase() !== '.pdf') {
      throw { statusCode: 400, message: 'The official Offer Letter must be uploaded as a PDF' };
    }

    // Read the upload before Drive removes the temporary file. The email is
    // triggered only after the upload and database update both succeed.
    const offerLetterBuffer = await fs.readFile(file.path);
    if (offerLetterBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw { statusCode: 400, message: 'The uploaded file content is not a valid PDF Offer Letter' };
    }

    // Drive: LOE {Passport} {Name} {University ID} {Date}
    const ctx = await this._namingContext(application);
    const { fileUrl, publicId } = await this._uploadNamed(file, `LOE ${ctx.passport} ${ctx.name} ${ctx.univId} ${ctx.date}`, application, ctx);

    // Create Document record so it appears in the Documents section
    await prisma.document.create({
      data: {
        tenantId, studentId: application.studentId, applicationId: id,
        uploadedById: userId, type: 'OFFER_LETTER', status: 'UPLOADED',
        originalName: file.originalname,
        fileName: file.filename || path.basename(file.path),
        fileUrl, fileSize: file.size, mimeType: file.mimetype, publicId,
      },
    });

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'OFFER_LETTER_ISSUED',
        progressPct: STATUS_PROGRESS.OFFER_LETTER_ISSUED,
        offerLetterUrl: fileUrl,
        offerLetterUploadedById: userId,
        offerLetterUploadedAt: new Date(),
      },
      include: this._detailInclude(),
    });
    if (application.status !== 'OFFER_LETTER_ISSUED') {
      await this._recordStatusHistory(id, userId, application.status, 'OFFER_LETTER_ISSUED', 'Offer Letter uploaded successfully');
    }
    whatsapp.notify('offer_letter_uploaded', updated);
    return updated;
  }

  async retryOfferLetterIssuedEmail(id, tenantId, userId, userRole) {
    if (!['TENANT_ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw { statusCode: 403, message: 'Only Tenant Admin can retry the Offer Letter Issued email' };
    }
    const application = await this._assertExists(id, tenantId);
    if (application.status !== 'OFFER_LETTER_ISSUED' || !application.offerLetterUrl) {
      throw { statusCode: 400, message: 'A successfully uploaded Offer Letter is required before retrying the email' };
    }
    const document = await prisma.document.findFirst({
      where: { tenantId, applicationId: id, studentId: application.studentId, type: 'OFFER_LETTER', status: 'UPLOADED', isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!document) throw { statusCode: 404, message: 'The official Offer Letter document could not be found' };
    const buffer = await this._readStoredOfferLetter(document);
    return require('../../services/offerLetterIssuedNotification').sendOfferLetterIssued({
      applicationId: id, tenantId, documentId: document.id, initiatedByUserId: userId,
      file: { buffer, mimetype: document.mimeType, originalname: document.originalName },
      forceResend: true,
    });
  }

  // ─── Upload Payment Proof (all authenticated users) ────────────────────────

  async uploadPaymentProof(id, tenantId, userId, file) {
    const application = await this._assertExists(id, tenantId);

    const OL_STAGES = ['OFFER_LETTER_ISSUED', 'EMGS_PROCESSING', 'COMPLETED'];
    if (!OL_STAGES.includes(application.status) && !application.offerLetterUrl) {
      throw { statusCode: 400, message: 'Offer Letter must be issued and uploaded before payment proof can be submitted' };
    }

    // Drive: EMGS payment {Passport} {Name} {Date}
    const ctx = await this._namingContext(application);
    const { fileUrl, publicId } = await this._uploadNamed(file, `EMGS payment ${ctx.passport} ${ctx.name} ${ctx.date}`, application, ctx);

    // Store as Document (BANK_STATEMENT type = payment proof)
    await prisma.document.create({
      data: {
        tenantId, studentId: application.studentId, applicationId: id,
        uploadedById: userId, type: 'BANK_STATEMENT', status: 'UPLOADED',
        originalName: file.originalname,
        fileName: file.filename || path.basename(file.path),
        fileUrl, fileSize: file.size, mimeType: file.mimetype, publicId,
        notes: 'Payment proof',
      },
    });

    const updated = await prisma.application.update({
      where: { id },
      data: {
        paymentProofUrl: fileUrl,
        paymentProofUploadedById: userId,
        paymentProofUploadedAt: new Date(),
      },
      include: this._detailInclude(),
    });
    whatsapp.notify('payment_proof_uploaded', updated);
    emailNotify.notify('payment_proof_uploaded', updated);
    return updated;
  }

  async deleteWorkflowDocument(id, tenantId, userRole, kind) {
    if (!['TENANT_ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw { statusCode: 403, message: 'Only admins can delete workflow documents' };
    }

    const definitions = {
      'offer-letter': {
        urlField: 'offerLetterUrl',
        documentType: 'OFFER_LETTER',
        clear: { offerLetterUrl: null, offerLetterUploadedById: null, offerLetterUploadedAt: null },
      },
      'payment-proof': {
        urlField: 'paymentProofUrl',
        documentType: 'BANK_STATEMENT',
        clear: {
          paymentProofUrl: null, paymentProofUploadedById: null, paymentProofUploadedAt: null,
          paymentVerifiedById: null, paymentVerifiedAt: null,
        },
      },
    };
    const definition = definitions[kind];
    if (!definition) throw { statusCode: 400, message: 'Unsupported workflow document type' };

    const application = await this._assertExists(id, tenantId);
    const fileUrl = application[definition.urlField];
    if (!fileUrl) throw { statusCode: 404, message: 'Workflow document not found' };

    const document = await prisma.document.findFirst({
      where: {
        tenantId, applicationId: id, studentId: application.studentId,
        type: definition.documentType, fileUrl, deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (document) await documentService.deleteDocument(document.id, tenantId);

    return prisma.application.update({
      where: { id },
      data: definition.clear,
      include: this._detailInclude(),
    });
  }

  // ─── Verify Payment (TENANT_ADMIN only) ───────────────────────────────────

  async verifyPayment(id, tenantId, userId, userRole, notes) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can verify payments' };
    }

    const application = await this._assertExists(id, tenantId);

    if (!application.paymentProofUrl) {
      throw { statusCode: 400, message: 'Payment proof must be uploaded before verification' };
    }
    if (application.paymentVerifiedAt) {
      throw { statusCode: 400, message: 'Payment is already verified' };
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        paymentVerifiedById: userId,
        paymentVerifiedAt: new Date(),
      },
      include: this._detailInclude(),
    });
    whatsapp.notify('payment_verified', updated);
    emailNotify.notify('payment_verified', updated);
    return updated;
  }

  // ─── Issue Invoice (TENANT_ADMIN only) ────────────────────────────────────

  async issueInvoice(id, tenantId, userId, userRole, notes, io) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can issue invoices' };
    }

    const application = await this._assertExists(id, tenantId);

    if (!application.paymentVerifiedAt) {
      throw { statusCode: 400, message: 'Payment must be verified before issuing invoice' };
    }
    if (application.invoiceIssuedAt) {
      throw { statusCode: 400, message: 'Invoice has already been issued' };
    }

    const oldStatus = application.status;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        invoiceIssuedById: userId,
        invoiceIssuedAt: new Date(),
        status: 'EMGS_PROCESSING',
        progressPct: STATUS_PROGRESS['EMGS_PROCESSING'],
        emgsPercentage: 0,
      },
      include: this._detailInclude(),
    });

    // The EMGS payment ledger creates its invoice as a draft during payment
    // setup. Issuing it here publishes that same invoice instead of leaving the
    // financial record in DRAFT while the application enters EMGS processing.
    await prisma.invoice.updateMany({
      where: { tenantId, applicationId: id, invoiceType: 'EMGS', status: 'DRAFT' },
      data: { status: 'ISSUED', issuedAt: new Date(), issuedById: userId },
    });

    await this._recordStatusHistory(id, userId, oldStatus, 'EMGS_PROCESSING',
      notes || 'Invoice issued — EMGS workflow started', 0);

    await this._notifyAgent(application, tenantId, id, 'STATUS_CHANGED', 'EMGS Process Started',
      `Invoice issued for ${application.referenceNo}. EMGS workflow has begun.`, io);

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:statusChanged', {
        id, referenceNo: application.referenceNo,
        oldStatus, newStatus: 'EMGS_PROCESSING',
        progressPct: STATUS_PROGRESS['EMGS_PROCESSING'],
        changedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  // ─── Update EMGS Progress (TENANT_ADMIN only) ─────────────────────────────

  async updateEmgsProgress(id, tenantId, userId, userRole, percentage, notes, io) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can update EMGS progress' };
    }

    const pct = parseInt(percentage);
    if (!EMGS_STEPS.includes(pct)) {
      throw { statusCode: 400, message: `Invalid EMGS percentage. Allowed: ${EMGS_STEPS.join(', ')}` };
    }

    const application = await this._assertExists(id, tenantId);

    if (!application.invoiceIssuedAt) {
      throw { statusCode: 400, message: 'Invoice must be issued before EMGS progress can be updated' };
    }
    if (application.status !== 'EMGS_PROCESSING' && application.status !== 'COMPLETED') {
      throw { statusCode: 400, message: 'Application must be in EMGS Processing stage' };
    }

    const newStatus = pct === 100 ? 'COMPLETED' : 'EMGS_PROCESSING';

    // Reaching 70% (eVAL Approved) automatically opens the post-eVAL workflow
    // at "Awaiting for eVisa" (only if it hasn't been started yet).
    const autoPostEval = pct === 70 && !application.postEvalStatus ? { postEvalStatus: 'AWAITING_EVISA' } : {};

    const updated = await prisma.application.update({
      where: { id },
      data: {
        emgsPercentage: pct,
        progressPct: pct,
        status: newStatus,
        ...autoPostEval,
        ...(newStatus === 'COMPLETED' && { completedAt: new Date() }),
      },
      include: this._detailInclude(),
    });

    // Log EMGS percentage change in history
    await this._recordStatusHistory(id, userId, application.status, newStatus,
      notes || `EMGS progress updated to ${pct}%`, pct);

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:statusChanged', {
        id, referenceNo: application.referenceNo,
        oldStatus: application.status, newStatus,
        progressPct: pct, emgsPercentage: pct,
        changedAt: new Date().toISOString(),
      });
    }

    emailNotify.notify('application_status_updated', updated, {
      status: newStatus.replace(/_/g, ' '),
      notifyTenantAdmin: newStatus === 'COMPLETED',
    });
    if (newStatus === 'COMPLETED') {
      emailNotify.notify('application_successful', updated);
    }

    return updated;
  }

  // ─── Update Post-eVAL Workflow Status (TENANT_ADMIN only) ─────────────────
  // Separate from the EMGS percentage. Only available once 70% eVAL Approved.

  async updatePostEvalStatus(id, tenantId, userId, userRole, status, io) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can update the post-eVAL workflow.' };
    }

    if (!POST_EVAL_STATUSES.includes(status)) {
      throw { statusCode: 400, message: `Invalid post-eVAL status. Allowed: ${POST_EVAL_STATUSES.join(', ')}` };
    }

    const application = await this._assertExists(id, tenantId);

    if ((application.emgsPercentage || 0) < 70) {
      throw { statusCode: 400, message: 'eVAL Approved (70%) must be reached before the post-eVAL workflow.' };
    }

    // ── Logical gating: a stage can't be reached until its prerequisites exist. ──
    // "eVisa Approved" requires both approval letters (EMGS + eVAL) uploaded.
    if (status === 'EVISA_APPROVED' && (!application.emgsApprovalUrl || !application.evalApprovalUrl)) {
      throw { statusCode: 400, message: 'Upload the EMGS approval and eVAL approval letters before this stage.' };
    }
    // Moving to "Under Arrival" or completing requires the eVisa document.
    if ((status === 'UNDER_ARRIVAL' || status === 'ARRIVAL_COMPLETED') && !application.evisaUrl) {
      throw { statusCode: 400, message: 'Upload the eVisa document before moving to this stage.' };
    }
    // Completing arrival requires the flight ticket and a verified tuition payment.
    if (status === 'ARRIVAL_COMPLETED') {
      if (!application.flightTicketUrl) {
        throw { statusCode: 400, message: 'Upload the flight ticket before completing arrival.' };
      }
      if (application.tuitionVerificationStatus !== 'VERIFIED') {
        throw { statusCode: 400, message: 'Tuition payment must be verified before completing arrival.' };
      }
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { postEvalStatus: status },
      include: this._baseInclude(),
    });

    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:postEvalChanged', {
        id, referenceNo: application.referenceNo, postEvalStatus: status,
        changedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  // ─── Update Arrival (Staff/Agent + Admin) ─────────────────────────────────
  // Staff/agent can set flight/arrival dates and upload the flight ticket.

  async updateArrival(id, tenantId, userId, userRole, { arrivalDate, flightDate }, file) {
    const application = await this._assertExists(id, tenantId);
    const data = {};

    if (file) {
      // Drive: Flight Ticket {Passport} {Name} {Date}
      const ctx = await this._namingContext(application);
      const { fileUrl } = await this._uploadNamed(file, `Flight Ticket ${ctx.passport} ${ctx.name} ${ctx.date}`, application, ctx);
      data.flightTicketUrl = fileUrl;
    }

    if (arrivalDate) data.arrivalDate = new Date(arrivalDate);
    if (flightDate) data.flightDate = new Date(flightDate);

    data.arrivalStatus = 'ARRIVED';

    const updated = await prisma.application.update({
      where: { id },
      data,
      include: this._baseInclude(),
    });
    if (arrivalDate) {
      whatsapp.notify('arrival_updated', updated, {
        arrivalDate: new Date(arrivalDate).toISOString().slice(0, 10),
      });
    }
    if (file) {
      emailNotify.notify('flight_ticket_uploaded', updated);
    }
    return updated;
  }

  // ─── Upload eVisa (Staff/Agent or Admin) ──────────────────────────────────

  async uploadEvisa(id, tenantId, userId, file) {
    const application = await this._assertExists(id, tenantId);

    // Drive: eVisa {Passport} {Name} {University ID}
    const ctx = await this._namingContext(application);
    const { fileUrl } = await this._uploadNamed(file, `eVisa ${ctx.passport} ${ctx.name} ${ctx.univId}`, application, ctx);

    const updated = await prisma.application.update({
      where: { id },
      data: {
        evisaUrl: fileUrl,
        evisaUploadedById: userId,
        evisaUploadedAt: new Date(),
      },
      include: this._baseInclude(),
    });
    whatsapp.notify('evisa_approved', updated);
    emailNotify.notify('evisa_approved', updated);
    return updated;
  }

  // ─── Upload EMGS Approval letter (Awaiting eVisa stage) ───────────────────

  async uploadEmgsApproval(id, tenantId, userId, file) {
    const application = await this._assertExists(id, tenantId);
    // Drive: EMGS Approval {Passport} {Name} {University ID}
    const ctx = await this._namingContext(application);
    const { fileUrl } = await this._uploadNamed(file, `EMGS Approval ${ctx.passport} ${ctx.name} ${ctx.univId}`, application, ctx);
    const updated = await prisma.application.update({
      where: { id },
      data: { emgsApprovalUrl: fileUrl, emgsApprovalUploadedById: userId, emgsApprovalUploadedAt: new Date() },
      include: this._baseInclude(),
    });
    whatsapp.notify('emgs_approved', updated);
    emailNotify.notify('emgs_approved', updated);
    return updated;
  }

  // ─── Upload eVAL Approval letter (Awaiting eVisa stage) ───────────────────

  async uploadEvalApproval(id, tenantId, userId, file) {
    const application = await this._assertExists(id, tenantId);
    // Drive: eVal {Passport} {Name} {University ID}
    const ctx = await this._namingContext(application);
    const { fileUrl } = await this._uploadNamed(file, `eVal ${ctx.passport} ${ctx.name} ${ctx.univId}`, application, ctx);
    const updated = await prisma.application.update({
      where: { id },
      data: { evalApprovalUrl: fileUrl, evalApprovalUploadedById: userId, evalApprovalUploadedAt: new Date() },
      include: this._baseInclude(),
    });
    whatsapp.notify('eval_approved', updated);
    emailNotify.notify('eval_approved', updated);
    return updated;
  }

  // ─── Upload Tuition Proof ─────────────────────────────────────────────────
  // Uploading (or re-uploading after a rejection) resets verification to PENDING.

  async uploadTuitionProof(id, tenantId, userId, file) {
    const application = await this._assertExists(id, tenantId);

    // Drive: Tuition Payment {Passport} {Name} {Date}
    const ctx = await this._namingContext(application);
    const { fileUrl } = await this._uploadNamed(file, `Tuition Payment ${ctx.passport} ${ctx.name} ${ctx.date}`, application, ctx);

    return prisma.application.update({
      where: { id },
      data: {
        tuitionProofUrl: fileUrl,
        tuitionProofUploadedById: userId,
        tuitionProofUploadedAt: new Date(),
        tuitionVerificationStatus: 'PENDING',
        tuitionVerificationRemarks: null,
        tuitionVerifiedById: null,
        tuitionVerifiedAt: null,
      },
      include: this._baseInclude(),
    });
  }

  // ─── Verify / Reject Tuition (TENANT_ADMIN only) ──────────────────────────

  async verifyTuition(id, tenantId, userId, userRole, { action = 'verify', remarks } = {}) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only admin can verify payment.' };
    }

    const application = await this._assertExists(id, tenantId);

    if (!application.tuitionProofUrl) {
      throw { statusCode: 400, message: 'Tuition payment proof must be uploaded before verification.' };
    }

    const now = new Date();

    if (action === 'reject') {
      return prisma.application.update({
        where: { id },
        data: {
          tuitionVerificationStatus: 'REJECTED',
          tuitionVerificationRemarks: remarks || null,
          tuitionVerifiedById: userId,
          tuitionVerifiedAt: now,
        },
        include: this._baseInclude(),
      });
    }

    // Verify (approve) → also issue the tuition invoice as before
    const updated = await prisma.application.update({
      where: { id },
      data: {
        tuitionVerificationStatus: 'VERIFIED',
        tuitionVerificationRemarks: remarks || null,
        tuitionVerifiedById: userId,
        tuitionVerifiedAt: now,
        tuitionInvoiceIssuedById: userId,
        tuitionInvoiceIssuedAt: now,
      },
      include: this._baseInclude(),
    });
    emailNotify.notify('arrival_payment_verified', updated);
    return updated;
  }

  // ─── Commission payout status (TENANT_ADMIN only) ─────────────────────────
  // Marks an application's commission ELIGIBLE or PAID and fires the matching
  // WhatsApp notification. Does not touch the workflow status.

  async setCommissionStatus(id, tenantId, userRole, status) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can update commission status.' };
    }
    const allowed = ['PENDING', 'ELIGIBLE', 'PAID'];
    if (!allowed.includes(status)) {
      throw { statusCode: 400, message: `Invalid commission status. Allowed: ${allowed.join(', ')}` };
    }
    await this._assertExists(id, tenantId);

    const updated = await prisma.application.update({
      where: { id },
      data: { commissionStatus: status, commissionStatusAt: new Date() },
      include: this._baseInclude(),
    });

    if (status === 'ELIGIBLE') whatsapp.notify('commission_eligible', updated);
    if (status === 'PAID') whatsapp.notify('commission_paid', updated);

    return updated;
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  async addNote(applicationId, tenantId, authorId, content, isPrivate, io) {
    await this._assertExists(applicationId, tenantId);
    const note = await prisma.applicationNote.create({
      data: { applicationId, authorId, content, isPrivate: isPrivate || false },
      include: { author: { select: { firstName: true, lastName: true, avatar: true } } },
    });
    if (io) {
      io.to(`tenant:${tenantId}`).emit('application:noteAdded', { applicationId, note });
    }
    return note;
  }

  async getNotes(applicationId, tenantId, userId, userRole) {
    const where = { applicationId };
    if (userRole === 'STAFF') {
      where.OR = [{ isPrivate: false }, { authorId: userId }];
    }
    return prisma.applicationNote.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true, avatar: true } } },
    });
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async getStatusHistory(applicationId, tenantId) {
    await this._assertExists(applicationId, tenantId);
    return prisma.statusHistory.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteApplication(id, tenantId, userRole) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only Tenant Admin can delete applications' };
    }
    await this._assertExists(id, tenantId);
    return prisma.application.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreApplication(id, tenantId) {
    const application = await prisma.application.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: { not: null } },
      include: { student: { select: { deletedAt: true } } },
    });
    if (!application) throw { statusCode: 404, message: 'Deleted application not found' };
    if (application.student.deletedAt) {
      throw { statusCode: 409, message: 'Restore the student profile before restoring this application' };
    }
    return prisma.application.update({
      where: { id },
      data: { deletedAt: null },
      include: this._listInclude(),
    });
  }

  async permanentlyDeleteApplication(id, tenantId) {
    const application = await prisma.application.findFirst({
      where: { id, ...(tenantId && { tenantId }), deletedAt: { not: null } },
      select: { id: true },
    });
    if (!application) throw { statusCode: 404, message: 'Deleted application not found' };

    return prisma.$transaction(async (tx) => {
      // Preserve shared student records and financial/document history while
      // removing their link to the permanently deleted application.
      await tx.notification.updateMany({ where: { applicationId: id }, data: { applicationId: null } });
      await tx.agentCommission.updateMany({ where: { applicationId: id }, data: { applicationId: null } });
      await tx.payment.updateMany({ where: { applicationId: id }, data: { applicationId: null } });
      await tx.document.updateMany({ where: { applicationId: id }, data: { applicationId: null } });
      await tx.lOE.deleteMany({ where: { applicationId: id } });
      return tx.application.delete({ where: { id } });
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  async _recordStatusHistory(applicationId, userId, fromStatus, toStatus, notes, emgsPercentage) {
    return prisma.statusHistory.create({
      data: {
        applicationId, changedById: userId,
        fromStatus: fromStatus || undefined,
        toStatus, notes,
        ...(emgsPercentage !== undefined && { emgsPercentage }),
      },
    });
  }

  async _notifyAgent(application, tenantId, applicationId, type, title, message, io) {
    if (!application.agentId) return;
    const notification = await prisma.notification.create({
      data: {
        tenantId, userId: application.agentId, applicationId,
        type, title, message,
        metadata: { referenceNo: application.referenceNo },
      },
    }).catch(() => null);
    if (io && notification) {
      io.to(`user:${application.agentId}`).emit('notification:new', notification);
    }
  }

  async _uploadFile(file, tenantId) {
    const { uploadToDrive } = require('../../services/driveUpload');
    // uploadToDrive falls back to local storage when Drive is not configured,
    // so driveFileId may be null — store null rather than an empty string.
    const { fileUrl, driveFileId } = await uploadToDrive(file, 'applications');
    return { fileUrl, publicId: driveFileId || null };
  }

  // ── Drive naming convention ───────────────────────────────────────────────
  // Every student has a portal unique id "MRSM-{PASSPORT} {NAME}" which is also
  // their Drive folder. Workflow documents are uploaded into that folder with a
  // strict file name (LOE / EMGS payment / eVisa / approval letters …).

  async _namingContext(application) {
    const student = await prisma.student.findUnique({
      where: { id: application.studentId },
      select: { fullName: true, passportNumber: true, driveFolderId: true },
    });
    const university = application.universityId
      ? await prisma.university.findUnique({ where: { id: application.universityId }, select: { name: true, code: true } })
      : null;

    const passport = (student?.passportNumber || 'NOPASS').trim().toUpperCase();
    const name = (student?.fullName || 'STUDENT').trim();
    const univId = (university?.code || university?.name || 'UNIV').trim();
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const folderName = `MRSM-${passport} ${name.toUpperCase()}`;
    return { student, university, passport, name, univId, date, folderName };
  }

  async _uploadNamed(file, baseName, application, ctx) {
    const { uploadNamedDocument } = require('../../services/driveUpload');
    ctx = ctx || await this._namingContext(application);
    const res = await uploadNamedDocument(file, baseName, ctx.folderName, ctx.student?.driveFolderId || null);
    // Cache the Drive folder id on the student when it is first created.
    if (res.driveFolderId && res.driveFolderId !== ctx.student?.driveFolderId) {
      await prisma.student
        .update({ where: { id: application.studentId }, data: { driveFolderId: res.driveFolderId, driveFolderName: ctx.folderName } })
        .catch(() => {});
    }
    return { fileUrl: res.fileUrl, publicId: res.driveFileId || null };
  }

  async _readStoredOfferLetter(document) {
    if (document.mimeType !== 'application/pdf') throw { statusCode: 400, message: 'The stored Offer Letter is not a PDF' };
    const maxBytes = Number(process.env.OFFER_LETTER_PREVIEW_MAX_BYTES) || 20 * 1024 * 1024;
    const parsed = new URL(document.fileUrl);
    let buffer;
    if (parsed.pathname.startsWith('/uploads/')) {
      const uploadsRoot = path.resolve(__dirname, '../../../uploads');
      const localPath = path.resolve(uploadsRoot, parsed.pathname.replace(/^\/uploads\//, ''));
      if (!localPath.startsWith(`${uploadsRoot}${path.sep}`)) throw { statusCode: 400, message: 'Invalid Offer Letter storage path' };
      buffer = await fs.readFile(localPath).catch(() => null);
    } else {
      const allowedHosts = new Set(['drive.google.com', 'www.googleapis.com', 'lh3.googleusercontent.com', 'mashroute.com', 'www.mashroute.com', ...(process.env.OFFER_LETTER_STORAGE_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean)]);
      if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) throw { statusCode: 400, message: 'Offer Letter storage host is not approved for email delivery' };
      const response = await fetch(document.fileUrl, { signal: AbortSignal.timeout(15000) }).catch(() => null);
      if (!response?.ok) throw { statusCode: 502, message: 'The Offer Letter file could not be retrieved. Please verify storage and retry.' };
      const contentLength = Number(response.headers.get('content-length'));
      if (contentLength > maxBytes) throw { statusCode: 400, message: 'The Offer Letter exceeds the secure preview size limit' };
      buffer = Buffer.from(await response.arrayBuffer());
    }
    if (!buffer?.length) throw { statusCode: 404, message: 'The Offer Letter file is missing from storage' };
    if (buffer.length > maxBytes) throw { statusCode: 400, message: 'The Offer Letter exceeds the secure preview size limit' };
    return buffer;
  }

  async _assertExists(id, tenantId) {
    const app = await prisma.application.findFirst({ where: { id, ...(tenantId && { tenantId }), deletedAt: null } });
    if (!app) throw { statusCode: 404, message: 'Application not found' };
    return app;
  }

  _baseInclude() {
    return {
      student: { select: { id: true, fullName: true, passportNumber: true, nationality: true, photo: true } },
      university: { select: { id: true, name: true, country: true, email: true } },
      agent: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      intakeRecord: { select: { id: true, campusId: true, campusCode: true, campusName: true, programmeId: true, programmeName: true, studyLevel: true, intakeMonth: true, intakeYear: true, intakeType: true, status: true } },
    };
  }

  _listInclude() {
    return { ...this._baseInclude(), _count: { select: { documents: true, notes: true } } };
  }

  _detailInclude() {
    return {
      student: true,
      university: true,
      agent: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
      intakeRecord: true,
      createdBy: { select: { firstName: true, lastName: true } },
      acceptedBy: { select: { firstName: true, lastName: true } },
      offerLetterUploadedBy: { select: { firstName: true, lastName: true } },
      paymentProofUploadedBy: { select: { firstName: true, lastName: true } },
      paymentVerifiedBy: { select: { firstName: true, lastName: true } },
      invoiceIssuedBy: { select: { firstName: true, lastName: true } },
      evisaUploadedBy: { select: { firstName: true, lastName: true } },
      tuitionProofUploadedBy: { select: { firstName: true, lastName: true } },
      tuitionVerifiedBy: { select: { firstName: true, lastName: true } },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      payments: { orderBy: { createdAt: 'desc' } },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { firstName: true, lastName: true } } },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { firstName: true, lastName: true, avatar: true } } },
      },
    };
  }
}

module.exports = new ApplicationService();
