const fs = require('fs');
const path = require('path');
const { getDriveClient, isDriveConfigured } = require('../config/drive');

const ROOT_FOLDER_ID = () => (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

function _localFallback(file) {
  const uploadsRoot = path.resolve(__dirname, '../../uploads');
  const rel = path.relative(uploadsRoot, file.path).replace(/\\/g, '/');
  // Use an absolute URL so files are viewable from the frontend's origin too.
  const base = (process.env.PUBLIC_API_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
  const url = `${base}/uploads/${rel}`;
  return { fileUrl: url, driveFileId: null, viewUrl: url, driveFolderId: null };
}

/**
 * Get or create a student-specific folder inside the root Drive folder.
 * Folder name: "{passportNumber} - {studentFullName}"
 */
async function getOrCreateStudentFolder(drive, folderName, existingFolderId) {
  // Try reusing existing folder
  if (existingFolderId) {
    try {
      await drive.files.get({ fileId: existingFolderId, fields: 'id', supportsAllDrives: true });
      return existingFolderId;
    } catch {
      // folder was deleted — fall through to create a new one
    }
  }

  // Search for folder with this name under root (avoid duplicates)
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and '${ROOT_FOLDER_ID()}' in parents and trashed=false`;
  const list = await drive.files.list({ q, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  if (list.data.files.length > 0) return list.data.files[0].id;

  // Create new student folder
  const folder = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [ROOT_FOLDER_ID()] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return folder.data.id;
}

/**
 * Upload a file to a student's Google Drive folder.
 * @param {object} file         - Multer file object
 * @param {string} docTitle     - Human-readable document type name
 * @param {string} folderName   - "{passportNo} - {studentName}"
 * @param {string|null} existingFolderId - Cached Drive folder ID for this student
 * @returns {{ fileUrl, driveFileId, viewUrl, driveFolderId }}
 */
async function uploadStudentDocument(file, docTitle, folderName, existingFolderId = null) {
  if (!isDriveConfigured()) return _localFallback(file);
  if (!ROOT_FOLDER_ID()) return _localFallback(file);

  try {
    const drive = getDriveClient();

    // Resolve student folder
    const folderId = await getOrCreateStudentFolder(drive, folderName, existingFolderId);

    // Build clean filename: "Passport Information Page - MD RAHIM - A12345.pdf"
    const ext = path.extname(file.originalname) || '';
    const cleanDocTitle = docTitle.replace(/[/\\?%*:|"<>]/g, '-');
    const cleanFolder = folderName.replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `${cleanDocTitle} - ${cleanFolder}${ext}`;

    const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: 'id',
      supportsAllDrives: true,
    });
    const fileId = response.data.id;

    // Make publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    if (!file._keepOnDisk) fs.unlink(file.path, () => {});

    return {
      fileUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      driveFileId: fileId,
      viewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      driveFolderId: folderId,
    };
  } catch (err) {
    // Drive down / refresh token expired → degrade to local storage instead of
    // failing the upload (matches uploadToDrive / uploadNamedDocument behaviour).
    console.warn(`[driveUpload] Student doc upload failed (${err?.message}); using local storage fallback.`);
    return _localFallback(file);
  }
}

/**
 * Upload a file into a student's Drive folder using an EXACT base file name.
 * Used for workflow documents (LOE, EMGS payment, eVisa, approval letters …)
 * that follow a strict naming convention.
 * @param {object} file              - Multer file object
 * @param {string} exactBaseName     - Final file name WITHOUT extension
 * @param {string} folderName        - Student folder name ("MRSM-{passport} {name}")
 * @param {string|null} existingFolderId
 * @returns {{ fileUrl, driveFileId, viewUrl, driveFolderId }}
 */
async function uploadNamedDocument(file, exactBaseName, folderName, existingFolderId = null) {
  if (!isDriveConfigured() || !ROOT_FOLDER_ID()) return _localFallback(file);

  try {
    const drive = getDriveClient();
    const folderId = await getOrCreateStudentFolder(drive, folderName, existingFolderId);

    const ext = path.extname(file.originalname) || '';
    const cleanBase = String(exactBaseName).replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
    const fileName = `${cleanBase}${ext}`;

    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
      fields: 'id',
      supportsAllDrives: true,
    });
    const fileId = response.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    if (!file._keepOnDisk) fs.unlink(file.path, () => {});

    return {
      fileUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      driveFileId: fileId,
      viewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      driveFolderId: folderId,
    };
  } catch (err) {
    console.warn(`[driveUpload] Named upload failed (${err?.message}); using local storage fallback.`);
    return _localFallback(file);
  }
}

/**
 * Generic upload (for non-student files: offer letters, payment proofs, LOE).
 */
async function uploadToDrive(file, category = 'uploads') {
  if (!isDriveConfigured()) return _localFallback(file);

  try {
    const drive = getDriveClient();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${category}_${Date.now()}_${safeName}`;

    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [ROOT_FOLDER_ID()] },
      media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
      fields: 'id',
      supportsAllDrives: true,
    });
    const fileId = response.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    if (!file._keepOnDisk) fs.unlink(file.path, () => {});

    return {
      fileUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      driveFileId: fileId,
      viewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      driveFolderId: null,
    };
  } catch (err) {
    // Drive may be temporarily unavailable or the OAuth token expired
    // (invalid_grant). Rather than fail the whole operation, keep the file in
    // local project storage so signup / company creation still succeeds.
    console.warn(`[driveUpload] Drive upload failed (${err?.message}); using local storage fallback.`);
    return _localFallback(file);
  }
}

async function deleteFromDrive(driveFileId) {
  if (!driveFileId || !isDriveConfigured()) return;
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
  } catch { /* non-fatal */ }
}

module.exports = { uploadToDrive, uploadStudentDocument, uploadNamedDocument, deleteFromDrive };
