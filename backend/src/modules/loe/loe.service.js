const prisma = require('../../config/database');
const path = require('path');
const crypto = require('crypto');

class LOEService {
  // ─── Guards ──────────────────────────────────────────────────────────────────

  _assertAdmin(userRole) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      const err = new Error('Only admin can generate LOE.');
      err.statusCode = 403;
      throw err;
    }
  }

  _assertIIMAT(university) {
    if (!university || !university.name || !university.name.includes('IIMAT')) {
      const err = new Error('LOE generation is currently available for IIMAT only.');
      err.statusCode = 400;
      throw err;
    }
  }

  // ─── LOE Number Generator ────────────────────────────────────────────────────

  generateLOENumber(program, applicationId) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    // Extract first letters of significant words (skip short connector words)
    const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', 'to', 'at', 'by']);
    const words = (program || '').split(/\s+/).filter(Boolean);
    const initials = words
      .filter((w) => !SKIP_WORDS.has(w.toLowerCase()))
      .map((w) => w[0].toUpperCase())
      .join('')
      .slice(0, 4);

    const suffix = String(applicationId).slice(-2).toUpperCase();

    return `LOE/INTL/${initials}${month}${year}${suffix}`;
  }

  // ─── Generate LOE ─────────────────────────────────────────────────────────────

  async generateLOE(applicationId, tenantId, userId, userRole, loeData) {
    this._assertAdmin(userRole);

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        university: true,
        student: true,
      },
    });

    if (!application) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    this._assertIIMAT(application.university);

    // Check for existing LOE to reuse loeNumber
    const existing = await prisma.lOE.findUnique({
      where: { applicationId },
    });

    const loeNumber = existing ? existing.loeNumber : this.generateLOENumber(application.program, applicationId);

    const loe = await prisma.lOE.upsert({
      where: { applicationId },
      create: {
        applicationId,
        tenantId,
        loeNumber,
        status: 'GENERATED',
        generatedAt: new Date(),
        generatedById: userId,
        scholarshipPct:       loeData.scholarshipPct      ?? 50,
        tuitionPerYear:       loeData.tuitionPerYear       ?? 18020,
        programDuration:      loeData.programDuration      ?? '2.5 Years',
        facultyName:          loeData.facultyName          ?? 'School of Social Science',
        englishRequirement:   loeData.englishRequirement   ?? 'English Placement Test required',
        additionalNotes:      loeData.additionalNotes      ?? null,
      },
      update: {
        status: 'GENERATED',
        generatedAt: new Date(),
        generatedById: userId,
        scholarshipPct:       loeData.scholarshipPct      ?? 50,
        tuitionPerYear:       loeData.tuitionPerYear       ?? 18020,
        programDuration:      loeData.programDuration      ?? '2.5 Years',
        facultyName:          loeData.facultyName          ?? 'School of Social Science',
        englishRequirement:   loeData.englishRequirement   ?? 'English Placement Test required',
        additionalNotes:      loeData.additionalNotes      ?? null,
        version: { increment: 1 },
      },
      include: {
        generatedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return { loe, application };
  }

  // ─── Get LOE ──────────────────────────────────────────────────────────────────

  async getLOE(applicationId, tenantId, userId, userRole) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        university: true,
        student: true,
      },
    });

    if (!application) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    if (userRole === 'STAFF' && application.agentId !== userId) {
      const err = new Error('You do not have permission to access this LOE.');
      err.statusCode = 403;
      throw err;
    }

    const loe = await prisma.lOE.findUnique({
      where: { applicationId },
      include: {
        generatedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return { loe, application };
  }

  // ─── Upload LOE ───────────────────────────────────────────────────────────────

  async uploadLOE(applicationId, tenantId, userId, userRole, file) {
    this._assertAdmin(userRole);

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        university: true,
        student: true,
      },
    });

    if (!application) {
      const err = new Error('Application not found.');
      err.statusCode = 404;
      throw err;
    }

    this._assertIIMAT(application.university);

    const { uploadToDrive } = require('../../services/driveUpload');
    const { fileUrl: uploadedFileUrl } = await uploadToDrive(file, 'loe');

    const existing = await prisma.lOE.findUnique({
      where: { applicationId },
    });

    const loeNumber = existing ? existing.loeNumber : this.generateLOENumber(application.program, applicationId);

    const loe = await prisma.lOE.upsert({
      where: { applicationId },
      create: {
        applicationId,
        tenantId,
        loeNumber,
        status: 'UPLOADED',
        uploadedFileUrl,
        generatedAt: new Date(),
        generatedById: userId,
      },
      update: {
        status: 'UPLOADED',
        uploadedFileUrl,
        version: { increment: 1 },
      },
    });

    return loe;
  }

  // ─── Delete LOE ───────────────────────────────────────────────────────────────

  async deleteLOE(applicationId, tenantId, userRole) {
    this._assertAdmin(userRole);

    await prisma.lOE.deleteMany({
      where: {
        applicationId,
        tenantId,
      },
    });

    return { success: true };
  }
}

module.exports = new LOEService();
