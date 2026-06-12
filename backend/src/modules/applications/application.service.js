const path = require('path');
const fs = require('fs').promises;
const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { generateReferenceNo } = require('../../utils/generateReference');
const whatsapp = require('../../services/whatsappNotify');

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

class ApplicationService {
  // ─── Create ───────────────────────────────────────────────────────────────

  async createApplication(tenantId, userId, data, io) {
    const referenceNo = generateReferenceNo('MR');

    const application = await prisma.application.create({
      data: {
        tenantId, studentId: data.studentId, universityId: data.universityId,
        agentId: data.agentId || userId, createdById: userId, referenceNo,
        program: data.program, intake: data.intake,
        intakeYear: data.intakeYear ? parseInt(data.intakeYear) : null,
        country: data.country, priority: data.priority || 'MEDIUM',
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
    return prisma.application.update({
      where: { id },
      data: {
        universityId: data.universityId, agentId: data.agentId,
        program: data.program, intake: data.intake,
        intakeYear: data.intakeYear ? parseInt(data.intakeYear) : undefined,
        country: data.country, priority: data.priority,
        rejectionReason: data.rejectionReason,
      },
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

  // ─── Update status (TENANT_ADMIN only, sequential) ────────────────────────

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

    // Enforce sequential order (REJECTED is always allowed)
    if (newStatus !== 'REJECTED') {
      const currentIdx = ORDERED_STATUSES.indexOf(oldStatus);
      const newIdx = ORDERED_STATUSES.indexOf(newStatus);
      if (newIdx !== currentIdx + 1) {
        throw {
          statusCode: 400,
          message: `Invalid transition: "${oldStatus}" → "${newStatus}". Must follow the workflow sequence.`,
        };
      }
    }

    const progressPct = STATUS_PROGRESS[newStatus] ?? application.progressPct;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: newStatus, progressPct,
        ...(newStatus === 'COMPLETED' && { completedAt: new Date() }),
      },
      include: this._baseInclude(),
    });

    await this._recordStatusHistory(id, userId, oldStatus, newStatus, notes);
    await this._notifyAgent(application, tenantId, id, 'STATUS_CHANGED', 'Application Status Updated',
      `${application.referenceNo} moved to ${newStatus.replace(/_/g, ' ')}`, io);

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

    if (application.status !== 'OFFER_LETTER_ISSUED') {
      throw { statusCode: 400, message: 'Offer Letter can only be uploaded when status is "Offer Letter Issued"' };
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
        offerLetterUrl: fileUrl,
        offerLetterUploadedById: userId,
        offerLetterUploadedAt: new Date(),
      },
      include: this._detailInclude(),
    });
    whatsapp.notify('offer_letter_uploaded', updated);
    return updated;
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
    return updated;
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
    return prisma.application.update({
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
