const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { uploadToDrive } = require('../../services/driveUpload');

/**
 * Normalize a multer field that may be an array (upload.fields) or a single
 * file object (upload.single) or undefined.
 */
function pickFile(field) {
  if (!field) return null;
  return Array.isArray(field) ? field[0] || null : field;
}

/**
 * Build a URL-friendly slug from an arbitrary string.
 */
function buildSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Public SaaS onboarding: register a company for super-admin approval.
 *
 * @param {object} data  - Form fields (req.body)
 * @param {object} files - Multer files: { logo, verificationDoc } (may be undefined)
 * @returns {{ tenant: { id, name, status } }}
 */
async function registerCompany(data = {}, files = {}) {
  // ── Validate required fields ──────────────────────────────────────────────
  const required = ['companyName', 'companyEmail', 'ownerEmail', 'ownerPassword', 'ownerFullName'];
  const missing = required.filter((key) => !data[key] || !String(data[key]).trim());
  if (missing.length > 0) {
    throw { statusCode: 400, message: `Missing required field(s): ${missing.join(', ')}` };
  }

  const companyName = String(data.companyName).trim();
  const companyEmail = String(data.companyEmail).trim().toLowerCase();
  const ownerEmail = String(data.ownerEmail).trim().toLowerCase();
  const ownerFullName = String(data.ownerFullName).trim();

  // ── Uniqueness checks ─────────────────────────────────────────────────────
  const existingTenant = await prisma.tenant.findFirst({ where: { email: companyEmail } });
  const existingUser = await prisma.user.findFirst({ where: { email: ownerEmail } });
  if (existingTenant || existingUser) {
    throw { statusCode: 400, message: 'An account with this email already exists.' };
  }

  // ── Build a unique slug ───────────────────────────────────────────────────
  let slug = buildSlug(companyName) || 'company';
  const slugTaken = await prisma.tenant.findFirst({ where: { slug } });
  if (slugTaken) {
    const suffix = buildSlug(ownerEmail.split('@')[0]).slice(0, 6) || Date.now().toString(36).slice(-4);
    slug = `${slug}-${suffix}`;
    // Final guard against an unlikely collision on the suffixed slug.
    const stillTaken = await prisma.tenant.findFirst({ where: { slug } });
    if (stillTaken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  // ── Upload files to Google Drive ──────────────────────────────────────────
  const logoFile = pickFile(files.logo);
  const docFile = pickFile(files.verificationDoc);

  let logoUpload = null;
  let docUpload = null;
  try {
    if (logoFile) logoUpload = await uploadToDrive(logoFile, 'company-logos');
    if (docFile) docUpload = await uploadToDrive(docFile, 'company-documents');
  } catch (err) {
    throw { statusCode: 502, message: 'Google Drive upload failed. Please try again.' };
  }

  // ── Create tenant (PENDING approval) ──────────────────────────────────────
  // Registration-specific metadata is kept in `settings` since the Tenant
  // model does not have dedicated columns for it.
  const verificationType = data.verificationType === 'passport' ? 'passport' : 'license';

  // Persist registration metadata onto the Tenant's dedicated columns so the
  // Super Admin approvals page (which reads tenant.verificationDocUrl,
  // tenant.contactPersonName, tenant.website, …) shows it correctly. Drive file
  // IDs are kept in `settings` since there are no columns for them.
  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      slug,
      email: companyEmail,
      phone: data.companyPhone || data.phone || null,
      address: data.companyAddress || data.address || null,
      country: data.companyCountry || data.country || null,
      website: data.website || null,
      logo: logoUpload ? logoUpload.fileUrl : null,
      status: 'PENDING',
      createdSource: 'public_signup',
      submittedAt: new Date(),
      contactPersonName: data.contactPersonName || ownerFullName,
      contactPersonEmail: data.contactPersonEmail || ownerEmail,
      contactPersonPhone: data.contactPersonPhone || data.ownerPhone || null,
      verificationType,
      verificationDocUrl: docUpload ? docUpload.fileUrl : null,
      verificationDocName: docFile ? docFile.originalname : null,
      settings: {
        verificationDocId: docUpload ? docUpload.driveFileId : null,
        logoDriveFileId: logoUpload ? logoUpload.driveFileId : null,
        ownerContact: {
          fullName: ownerFullName,
          email: ownerEmail,
          phone: data.ownerPhone || null,
        },
      },
    },
  });

  // ── Create the owner user (inactive until approved) ───────────────────────
  const hashedPassword = await bcrypt.hash(String(data.ownerPassword), 12);
  const nameParts = ownerFullName.split(/\s+/);
  const firstName = nameParts.shift() || ownerFullName;
  const lastName = nameParts.join(' ') || '';

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: ownerEmail,
      password: hashedPassword,
      firstName,
      lastName,
      phone: data.ownerPhone || null,
      role: 'TENANT_ADMIN',
      isActive: false, // cannot log in until super admin approves
      isEmailVerified: true,
    },
  });

  // ── Notify super admins ───────────────────────────────────────────────────
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (superAdmins.length > 0) {
      await prisma.notification.createMany({
        data: superAdmins.map((admin) => ({
          userId: admin.id,
          tenantId: null,
          type: 'SYSTEM',
          title: 'New company registration',
          message: `${companyName} has requested an account`,
        })),
      });
    }
  } catch (err) {
    // Notifications are non-critical; never fail the registration over them.
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
    },
  };
}

module.exports = { registerCompany };
