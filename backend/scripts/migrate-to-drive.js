/**
 * One-time migration: upload all locally-stored files to Google Drive
 * and update every database reference to use the new Drive URL.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { uploadToDrive } = require('../src/services/driveUpload');

const prisma = new PrismaClient();
const UPLOADS_ROOT = path.resolve(__dirname, '../uploads');

function isLocalPath(url) {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.startsWith('uploads/');
}

function resolveLocalPath(url) {
  // Strip leading slash and prefix with uploads root
  const rel = url.replace(/^\//, '');
  return path.resolve(__dirname, '..', rel);
}

async function uploadLocalFile(localUrl, category) {
  const absPath = resolveLocalPath(localUrl);

  if (!fs.existsSync(absPath)) {
    console.log(`  ⚠️  File not found on disk: ${absPath} — skipping`);
    return null;
  }

  const filename = path.basename(absPath);
  const fakeFile = {
    path: absPath,
    originalname: filename,
    mimetype: 'application/pdf',
    size: fs.statSync(absPath).size,
    _keepOnDisk: true, // signal: don't delete after upload
  };

  const result = await uploadToDrive(fakeFile, category);
  return result;
}

async function main() {
  console.log('\n🚀 MashRoute — Migrate local files to Google Drive\n');

  // ─── 1. Documents ────────────────────────────────────────────────────────────
  const localDocs = await prisma.document.findMany({
    where: { deletedAt: null, publicId: null },
  });

  const localDocsByUrl = localDocs.filter(d => isLocalPath(d.fileUrl));
  console.log(`📄 Documents to migrate: ${localDocsByUrl.length}`);

  const urlMap = {}; // old local URL → new Drive URL

  for (const doc of localDocsByUrl) {
    process.stdout.write(`  Uploading ${doc.type} (${doc.originalName || doc.fileUrl})... `);
    try {
      const result = await uploadLocalFile(doc.fileUrl, 'documents');
      if (!result) continue;

      await prisma.document.update({
        where: { id: doc.id },
        data: { fileUrl: result.fileUrl, publicId: result.driveFileId },
      });

      urlMap[doc.fileUrl]                        = result.fileUrl;
      urlMap['/' + doc.fileUrl]                  = result.fileUrl;
      urlMap[doc.fileUrl.replace(/^\//, '')]     = result.fileUrl;

      console.log(`✅  ${result.viewUrl}`);
    } catch (err) {
      console.log(`❌  ${err.message}`);
    }
  }

  // ─── 2. Application offer letters & payment proofs ───────────────────────────
  const appsWithLocalFiles = await prisma.application.findMany({
    where: {
      deletedAt: null,
      OR: [
        { offerLetterUrl: { not: null } },
        { paymentProofUrl: { not: null } },
      ],
    },
    select: { id: true, offerLetterUrl: true, paymentProofUrl: true },
  });

  const appsToUpdate = appsWithLocalFiles.filter(
    a => isLocalPath(a.offerLetterUrl) || isLocalPath(a.paymentProofUrl)
  );
  console.log(`\n📋 Applications to update: ${appsToUpdate.length}`);

  for (const app of appsToUpdate) {
    const updates = {};

    // Use already-uploaded URL from urlMap if available, otherwise re-upload
    if (isLocalPath(app.offerLetterUrl)) {
      if (urlMap[app.offerLetterUrl]) {
        updates.offerLetterUrl = urlMap[app.offerLetterUrl];
        console.log(`  ✅ App ${app.id} offerLetterUrl → Drive (reused)`);
      } else {
        process.stdout.write(`  Uploading offer letter for app ${app.id.slice(0,8)}... `);
        try {
          const r = await uploadLocalFile(app.offerLetterUrl, 'applications');
          if (r) { updates.offerLetterUrl = r.fileUrl; console.log('✅'); }
        } catch (e) { console.log('❌', e.message); }
      }
    }

    if (isLocalPath(app.paymentProofUrl)) {
      if (urlMap[app.paymentProofUrl]) {
        updates.paymentProofUrl = urlMap[app.paymentProofUrl];
        console.log(`  ✅ App ${app.id} paymentProofUrl → Drive (reused)`);
      } else {
        process.stdout.write(`  Uploading payment proof for app ${app.id.slice(0,8)}... `);
        try {
          const r = await uploadLocalFile(app.paymentProofUrl, 'applications');
          if (r) { updates.paymentProofUrl = r.fileUrl; console.log('✅'); }
        } catch (e) { console.log('❌', e.message); }
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.application.update({ where: { id: app.id }, data: updates });
    }
  }

  // ─── 3. LOE uploaded files ───────────────────────────────────────────────────
  const localLOEs = await prisma.lOE.findMany({
    where: { uploadedFileUrl: { not: null } },
  });
  const loesToMigrate = localLOEs.filter(l => isLocalPath(l.uploadedFileUrl));
  console.log(`\n📝 LOE files to migrate: ${loesToMigrate.length}`);

  for (const loe of loesToMigrate) {
    process.stdout.write(`  Uploading LOE ${loe.id.slice(0,8)}... `);
    try {
      const r = await uploadLocalFile(loe.uploadedFileUrl, 'loe');
      if (r) {
        await prisma.lOE.update({ where: { id: loe.id }, data: { uploadedFileUrl: r.fileUrl } });
        console.log('✅');
      }
    } catch (e) { console.log('❌', e.message); }
  }

  console.log('\n✅ Migration complete. All files are now on Google Drive.\n');
}

main()
  .catch(err => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
