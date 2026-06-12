const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { uploadToDrive } = require('../../services/driveUpload');

function pickFile(field) {
  if (!field) return null;
  return Array.isArray(field) ? field[0] || null : field;
}

class TenantService {
  async createTenant(data, files = {}) {
    const {
      name,
      email,
      phone,
      country,
      address,
      plan,
      logo,
      website,
      contactPersonName,
      contactPersonEmail,
      contactPersonPhone,
      verificationType,
      maxUsers,
      maxStudents,
    } = data;

    // Admin credentials may arrive nested (`admin: {...}` from a JSON form) or
    // flat (`adminEmail`/`adminPassword` from a multipart form). Support both.
    const admin = data.admin || {};
    const adminFirstName = admin.firstName ?? data.adminFirstName;
    const adminLastName = admin.lastName ?? data.adminLastName;
    const adminPassword = admin.password ?? data.adminPassword;

    // Emails must be stored lowercased — login looks them up with
    // `email.toLowerCase()`, so any uppercase here would break sign-in.
    const tenantEmail = email ? String(email).trim().toLowerCase() : null;
    const adminEmailRaw = admin.email ?? data.adminEmail ?? email;
    const adminEmail = adminEmailRaw ? String(adminEmailRaw).trim().toLowerCase() : null;

    if (!adminEmail) {
      throw { statusCode: 400, message: 'An admin email is required to create the login account.' };
    }

    // Guard against duplicate user email (global unique) with a clean message
    // instead of a raw Prisma constraint error.
    const existingUser = await prisma.user.findFirst({ where: { email: adminEmail } });
    if (existingUser) {
      throw { statusCode: 400, message: 'A user with this admin email already exists.' };
    }

    // Upload logo + verification document to Drive (if provided). Falls back to
    // local storage automatically when Drive isn't configured.
    const logoFile = pickFile(files.logo);
    const docFile = pickFile(files.verificationDoc);
    let logoUrl = logo;
    let verificationDocUrl = null;
    let verificationDocId = null;
    let logoDriveFileId = null;
    try {
      if (logoFile) {
        const up = await uploadToDrive(logoFile, 'company-logos');
        logoUrl = up.fileUrl;
        logoDriveFileId = up.driveFileId || null;
      }
      if (docFile) {
        const up = await uploadToDrive(docFile, 'company-documents');
        verificationDocUrl = up.fileUrl;
        verificationDocId = up.driveFileId || null;
      }
    } catch (err) {
      console.error('[tenant create] file upload failed:', err?.message, err?.errors || err?.response?.data || '');
      throw { statusCode: 502, message: 'File upload failed. Please try again.' };
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure slug uniqueness
    const exists = await prisma.tenant.findFirst({ where: { slug } });
    const finalSlug = exists ? `${slug}-${Date.now()}` : slug;

    const hashedPassword = await bcrypt.hash(adminPassword || 'Admin@123!', 12);

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug: finalSlug,
          email: tenantEmail,
          phone,
          country,
          status: 'ACTIVE',
          createdSource: 'super_admin',
          approvedAt: new Date(),
          plan: plan || 'STARTER',
          ...(address !== undefined && { address }),
          ...(logoUrl !== undefined && logoUrl !== null && { logo: logoUrl }),
          ...(website !== undefined && { website }),
          ...(contactPersonName !== undefined && { contactPersonName }),
          ...(contactPersonEmail !== undefined && { contactPersonEmail }),
          ...(contactPersonPhone !== undefined && { contactPersonPhone }),
          ...(verificationType !== undefined && { verificationType }),
          ...(verificationDocUrl && { verificationDocUrl, verificationDocName: docFile?.originalname || null }),
          ...((verificationDocId || logoDriveFileId) && {
            settings: { verificationDocId, logoDriveFileId },
          }),
          ...(maxUsers !== undefined && maxUsers !== null && maxUsers !== '' && { maxUsers: Number(maxUsers) }),
          ...(maxStudents !== undefined && maxStudents !== null && maxStudents !== '' && { maxStudents: Number(maxStudents) }),
        },
      });

      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName || 'Admin',
          lastName: adminLastName || name,
          role: 'TENANT_ADMIN',
          isEmailVerified: true,
          isActive: true,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: newTenant.id,
          plan: plan || 'STARTER',
          price: plan === 'ENTERPRISE' ? 299 : plan === 'PROFESSIONAL' ? 99 : 29,
          startsAt: new Date(),
          isActive: true,
        },
      });

      return newTenant;
    });

    return tenant;
  }

  async listTenants(query) {
    const { page, limit, skip } = getPagination(query);
    const { search, status, plan } = query;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(plan && { plan }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, students: true, applications: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return { tenants, pagination: getPaginationMeta(total, page, limit) };
  }

  async getTenant(id) {
    const tenant = await prisma.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { users: true, students: true, applications: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!tenant) throw { statusCode: 404, message: 'Tenant not found' };
    return tenant;
  }

  async updateTenant(id, data) {
    // Only assign keys that were actually provided so we never null out columns.
    const fields = [
      'name', 'phone', 'country', 'address', 'website', 'logo', 'settings',
      'maxUsers', 'maxStudents', 'contactPersonName', 'contactPersonEmail', 'contactPersonPhone',
    ];
    const updateData = {};
    for (const key of fields) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    return prisma.tenant.update({ where: { id }, data: updateData });
  }

  async suspendTenant(id) {
    return prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  async activateTenant(id) {
    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    // Activating a tenant must also re-enable its admin login — otherwise a
    // company approved/activated from the Tenants page has an inactive admin
    // who cannot sign in. Mirrors approveTenant().
    await prisma.user.updateMany({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
      data: { isActive: true },
    });
    return updated;
  }

  async deleteTenant(id) {
    return prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }

  async listPending() {
    return prisma.tenant.findMany({
      where: { status: 'PENDING', deletedAt: null },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async getPendingCount() {
    return prisma.tenant.count({
      where: { status: 'PENDING', deletedAt: null },
    });
  }

  async approveTenant(id, approverId) {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw { statusCode: 404, message: 'Tenant not found' };

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    await prisma.user.updateMany({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
      data: { isActive: true },
    });

    // Best-effort notifications to tenant admin user(s)
    try {
      const admins = await prisma.user.findMany({
        where: { tenantId: id, role: 'TENANT_ADMIN' },
        select: { id: true },
      });
      if (admins.length) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            type: 'APPROVAL',
            title: 'Account approved',
            message: 'Your company account has been approved. You can now log in.',
            tenantId: id,
            userId: admin.id,
          })),
        });
      }
    } catch (err) {
      // ignore notification failures
    }

    return updated;
  }

  async rejectTenant(id, approverId, reason) {
    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    // Keep owner users inactive
    await prisma.user.updateMany({
      where: { tenantId: id, role: 'TENANT_ADMIN' },
      data: { isActive: false },
    });

    // Best-effort notifications to tenant admin user(s)
    try {
      const admins = await prisma.user.findMany({
        where: { tenantId: id, role: 'TENANT_ADMIN' },
        select: { id: true },
      });
      if (admins.length) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            type: 'REJECTION',
            title: 'Account rejected',
            message: reason,
            tenantId: id,
            userId: admin.id,
          })),
        });
      }
    } catch (err) {
      // ignore notification failures
    }

    return updated;
  }

  async getTenantStats() {
    const [total, active, suspended, byPlan] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
      prisma.tenant.groupBy({
        by: ['plan'],
        where: { deletedAt: null },
        _count: { plan: true },
      }),
    ]);
    return { total, active, suspended, byPlan };
  }
}

module.exports = new TenantService();
