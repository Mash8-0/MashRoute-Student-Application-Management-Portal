const path = require('path');
const fs = require('fs').promises;
const prisma = require('../../config/database');
const { uploadStudentDocument, deleteFromDrive } = require('../../services/driveUpload');

// Map DocumentType enum to human-readable title
const DOC_TITLES = {
  PASSPORT:            'Passport Information Page',
  PASSPORT_FULL_SCAN:  'Full Scanned Copy of Passport',
  PHOTO:               'Student Photo',
  ACADEMIC_DOCUMENTS:  'Academic Documents',
  ENGLISH_PROFICIENCY: 'English Proficiency Certificate',
  SSC_CERTIFICATE:     'SSC Certificate',
  HSC_CERTIFICATE:     'HSC Certificate',
  DIPLOMA:             'Diploma',
  BACHELOR_DEGREE:     'Bachelor Degree',
  MASTERS_DEGREE:      'Masters Degree',
  TRANSCRIPT:          'Transcript',
  BANK_STATEMENT:      'Bank Statement',
  IELTS_CERTIFICATE:   'IELTS Certificate',
  PTE_CERTIFICATE:     'PTE Certificate',
  MOI_CERTIFICATE:     'MOI Certificate',
  OFFER_LETTER:        'Offer Letter',
  EMGS_DOCUMENT:       'EMGS Document',
  EVAL_DOCUMENT:       'EVAL Document',
  VISA_DOCUMENT:       'Visa Document',
  MEDICAL_CERTIFICATE: 'Medical Certificate',
  ADDITIONAL:          'Additional Document',
};

async function _deleteLocalFile(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  try {
    const rel = fileUrl.replace(/^\/uploads\//, '');
    await fs.unlink(path.join(__dirname, '../../../uploads', rel));
  } catch { /* non-fatal */ }
}

class DocumentService {
  async uploadDocument(tenantId, uploaderId, file, data) {
    const { studentId, applicationId, type, notes, expiryDate, documentStage } = data;

    // Load student to get name/passport and existing Drive folder
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: { id: true, fullName: true, passportNumber: true, driveFolderId: true, driveFolderName: true },
    });
    if (!student) throw { statusCode: 404, message: 'Student not found' };

    // Validate required student fields for Drive folder naming
    if (!student.passportNumber) throw { statusCode: 400, message: 'Passport number is required before uploading documents.' };
    if (!student.fullName)       throw { statusCode: 400, message: 'Student name is required before uploading documents.' };

    const folderName  = `${student.passportNumber.trim().toUpperCase()} - ${student.fullName.trim().toUpperCase()}`;
    const docTitle    = DOC_TITLES[type] || type;

    let fileUrl, driveFileId, viewUrl, driveFolderId;

    try {
      const result = await uploadStudentDocument(file, docTitle, folderName, student.driveFolderId);
      fileUrl      = result.fileUrl;
      driveFileId  = result.driveFileId;
      viewUrl      = result.viewUrl;
      driveFolderId = result.driveFolderId;
    } catch (err) {
      throw { statusCode: 502, message: 'Google Drive upload failed. Please try again.' };
    }

    // Persist student folder ID so future uploads reuse it
    if (driveFolderId && driveFolderId !== student.driveFolderId) {
      await prisma.student.update({
        where: { id: studentId },
        data: { driveFolderId, driveFolderName: folderName },
      });
    }

    const fileSource = driveFileId ? 'google_drive' : 'local';

    const document = await prisma.document.create({
      data: {
        tenantId,
        studentId,
        applicationId: applicationId || null,
        uploadedById: uploaderId,
        type,
        status: 'UPLOADED',
        documentStage: documentStage || null,
        verificationStatus: 'NONE',
        originalName: file.originalname,
        fileName: file.originalname,
        fileUrl,
        driveViewLink: viewUrl || null,
        fileSource,
        driveFolderId: driveFolderId || null,
        publicId: driveFileId || null,
        fileSize: file.size,
        mimeType: file.mimetype,
        notes,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    return document;
  }

  async listDocuments(tenantId, studentId, query = {}) {
    const { type, status, applicationId } = query;
    const where = {
      ...(tenantId && { tenantId }), studentId, deletedAt: null,
      ...(type && { type }),
      ...(status && { status }),
      ...(applicationId && { applicationId }),
    };
    return prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async getDocument(id, tenantId) {
    const doc = await prisma.document.findFirst({ where: { id, ...(tenantId && { tenantId }), deletedAt: null } });
    if (!doc) throw { statusCode: 404, message: 'Document not found' };
    return doc;
  }

  async updateDocumentStatus(id, tenantId, status, notes) {
    await this.getDocument(id, tenantId);
    return prisma.document.update({ where: { id }, data: { status, notes } });
  }

  async verifyDocument(id, tenantId, userId, userRole) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only admin can verify payment.' };
    }
    await this.getDocument(id, tenantId);
    return prisma.document.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });
  }

  async rejectDocument(id, tenantId, userId, userRole, reason) {
    if (userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Only admin can verify payment.' };
    }
    await this.getDocument(id, tenantId);
    return prisma.document.update({
      where: { id },
      data: {
        status: 'REJECTED',
        verificationStatus: 'REJECTED',
        rejectedReason: reason,
      },
    });
  }

  async deleteDocument(id, tenantId) {
    const doc = await this.getDocument(id, tenantId);
    if (doc.publicId) await deleteFromDrive(doc.publicId);
    else if (doc.fileUrl) await _deleteLocalFile(doc.fileUrl);
    return prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async listByApplication(tenantId, applicationId) {
    return prisma.document.findMany({
      where: { ...(tenantId && { tenantId }), applicationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replaceDocument(id, tenantId, uploaderId, file) {
    const existing = await this.getDocument(id, tenantId);

    // Remove old file
    if (existing.publicId) await deleteFromDrive(existing.publicId);
    else if (existing.fileUrl) await _deleteLocalFile(existing.fileUrl);

    // Get student for folder logic
    const student = await prisma.student.findFirst({
      where: { id: existing.studentId },
      select: { fullName: true, passportNumber: true, driveFolderId: true },
    });

    const folderName = student?.passportNumber && student?.fullName
      ? `${student.passportNumber.trim().toUpperCase()} - ${student.fullName.trim().toUpperCase()}`
      : 'documents';

    const docTitle = DOC_TITLES[existing.type] || existing.type;
    const result = await uploadStudentDocument(file, docTitle, folderName, student?.driveFolderId || null);

    return prisma.document.update({
      where: { id },
      data: {
        originalName: file.originalname,
        fileName: file.originalname,
        fileUrl: result.fileUrl,
        driveViewLink: result.viewUrl || null,
        fileSource: result.driveFileId ? 'google_drive' : 'local',
        driveFolderId: result.driveFolderId || null,
        publicId: result.driveFileId || null,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'UPLOADED',
        updatedAt: new Date(),
      },
    });
  }
}

module.exports = new DocumentService();
