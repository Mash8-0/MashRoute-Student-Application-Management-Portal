const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const prisma = require('../../config/database');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);

const ASSIGN_INCLUDE = { assignedTenants: { select: { id: true, name: true } } };

// ─── Multer (logo uploads) ──────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/temp'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  fileFilter: (req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be JPEG, PNG, WEBP or SVG'), false),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Whitelist of editable fields (prevents passing relations/ids back into update).
function pickFields(body) {
  const out = {};
  for (const k of ['name', 'code', 'country', 'city', 'website', 'email', 'phone', 'courses', 'intakes', 'logo', 'isActive']) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// ─── List ─────────────────────────────────────────────────────────────────────
// Super admin → the master list (global universities) with their assignments.
// Tenant admin / staff → only universities assigned to them (+ their own legacy ones).
router.get('/', asyncHandler(async (req, res) => {
  const { search, country } = req.query;
  const isSuper = req.user.role === 'SUPER_ADMIN';

  const and = [{ isActive: true }];
  if (country) and.push({ country });
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (isSuper) {
    and.push({ tenantId: null }); // master list
  } else {
    and.push({
      OR: [
        { assignedTenants: { some: { id: req.tenantId } } },
        { tenantId: req.tenantId }, // legacy tenant-owned universities
      ],
    });
  }

  const universities = await prisma.university.findMany({
    where: { AND: and },
    ...(isSuper && { include: ASSIGN_INCLUDE }),
    orderBy: { name: 'asc' },
  });
  return ApiResponse.success(res, universities);
}));

// ─── Get one ────────────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'SUPER_ADMIN';
  const uni = await prisma.university.findUnique({ where: { id: req.params.id }, include: ASSIGN_INCLUDE });
  if (!uni) throw { statusCode: 404, message: 'University not found' };
  if (!isSuper) {
    const allowed = uni.tenantId === req.tenantId || (uni.assignedTenants || []).some((t) => t.id === req.tenantId);
    if (!allowed) throw { statusCode: 403, message: 'University not available to your agency' };
  }
  return ApiResponse.success(res, uni);
}));

// ─── Upload logo ────────────────────────────────────────────────────────────────
router.post('/:id/logo', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const { uploadToDrive } = require('../../services/driveUpload');
  const { fileUrl } = await uploadToDrive(req.file, 'university-logos');
  const isSuper = req.user.role === 'SUPER_ADMIN';
  const uni = await prisma.university.update({
    where: { id: req.params.id },
    data: { logo: fileUrl },
    ...(isSuper && { include: ASSIGN_INCLUDE }),
  });
  return ApiResponse.success(res, uni, 'Logo uploaded');
}));

// ─── Create ─────────────────────────────────────────────────────────────────────
// Super admin creates a global master university (+ assigns tenants).
// Tenant admin can still create their own tenant-scoped one (legacy).
router.post('/', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'SUPER_ADMIN';
  const { assignedTenantIds } = req.body;

  const uni = await prisma.university.create({
    data: {
      ...pickFields(req.body),
      tenantId: isSuper ? null : req.tenantId,
      isActive: true,
      ...(isSuper && Array.isArray(assignedTenantIds) && {
        assignedTenants: { connect: assignedTenantIds.map((id) => ({ id })) },
      }),
    },
    ...(isSuper && { include: ASSIGN_INCLUDE }),
  });
  return ApiResponse.created(res, uni, 'University added');
}));

// ─── Update ─────────────────────────────────────────────────────────────────────
router.patch('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'SUPER_ADMIN';
  const { assignedTenantIds } = req.body;

  const uni = await prisma.university.update({
    where: { id: req.params.id },
    data: {
      ...pickFields(req.body),
      ...(isSuper && Array.isArray(assignedTenantIds) && {
        assignedTenants: { set: assignedTenantIds.map((id) => ({ id })) },
      }),
    },
    ...(isSuper && { include: ASSIGN_INCLUDE }),
  });
  return ApiResponse.success(res, uni, 'University updated');
}));

// ─── Commission: ensure the tenant may see this university ───────────────────────
async function assertVisible(req) {
  const isSuper = req.user.role === 'SUPER_ADMIN';
  const uni = await prisma.university.findUnique({ where: { id: req.params.id }, include: ASSIGN_INCLUDE });
  if (!uni) throw { statusCode: 404, message: 'University not found' };
  if (!isSuper) {
    const allowed = uni.tenantId === req.tenantId || (uni.assignedTenants || []).some((t) => t.id === req.tenantId);
    if (!allowed) throw { statusCode: 403, message: 'University not available to your agency' };
  }
  return uni;
}

const RELEASE_TIMINGS = ['UPFRONT', 'AFTER_REGISTRATION', 'AFTER_ENROLLMENT', 'ON_COMPLETION'];

// ─── List commissions (tenant-scoped) ────────────────────────────────────────────
// Visible to the tenant's admins and staff so agents can see their applicable rate.
// Returns { rows, policy } — policy holds release timing & notes.
router.get('/:id/commissions', asyncHandler(async (req, res) => {
  await assertVisible(req);
  // Super admin has no tenant context → no per-tenant commissions to return.
  if (!req.tenantId) return ApiResponse.success(res, { rows: [], policy: null });
  const [rows, policy] = await Promise.all([
    prisma.universityCommission.findMany({ where: { tenantId: req.tenantId, universityId: req.params.id } }),
    prisma.universityCommissionPolicy.findUnique({
      where: { tenantId_universityId: { tenantId: req.tenantId, universityId: req.params.id } },
    }),
  ]);
  return ApiResponse.success(res, { rows, policy });
}));

// ─── Set commissions (tenant admin) ──────────────────────────────────────────────
// Body: { rows: [{ course?, category, amount, type, currency }], policy?: { releaseTiming, notes } }
// course "" (or omitted) = default rate for all programs; a course name = override.
router.put('/:id/commissions', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  await assertVisible(req);
  if (!req.tenantId) throw { statusCode: 400, message: 'No agency context' };
  const { isValidCategory } = require('../../utils/agentCategories');
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const policyIn = req.body.policy;

  const universityId = req.params.id;
  const tenantId = req.tenantId;

  const ops = rows
    .filter((r) => isValidCategory(r.category))
    .map((r) => {
      const course = (r.course || '').trim();
      const data = {
        amount: Number(r.amount) || 0,
        type: r.type === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
        currency: r.currency || 'MYR',
      };
      return prisma.universityCommission.upsert({
        where: { tenantId_universityId_course_category: { tenantId, universityId, course, category: r.category } },
        create: { tenantId, universityId, course, category: r.category, ...data },
        update: data,
      });
    });

  if (policyIn && typeof policyIn === 'object') {
    const str = (v) => (v ? String(v).slice(0, 200) : null);
    const releaseTiming = RELEASE_TIMINGS.includes(policyIn.releaseTiming) ? policyIn.releaseTiming : 'AFTER_REGISTRATION';
    const data = {
      releaseTiming,
      commissionType: str(policyIn.commissionType),
      payoutTime: str(policyIn.payoutTime),
      payoutMethod: str(policyIn.payoutMethod),
      specialBonus: str(policyIn.specialBonus),
      notes: policyIn.notes ? String(policyIn.notes).slice(0, 2000) : null,
    };
    ops.push(prisma.universityCommissionPolicy.upsert({
      where: { tenantId_universityId: { tenantId, universityId } },
      create: { tenantId, universityId, ...data },
      update: data,
    }));
  }

  await prisma.$transaction(ops);

  const [savedRows, policy] = await Promise.all([
    prisma.universityCommission.findMany({ where: { tenantId, universityId } }),
    prisma.universityCommissionPolicy.findUnique({ where: { tenantId_universityId: { tenantId, universityId } } }),
  ]);
  return ApiResponse.success(res, { rows: savedRows, policy }, 'Commissions updated');
}));

// ─── Delete (soft) ───────────────────────────────────────────────────────────────
router.delete('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  await prisma.university.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  return ApiResponse.success(res, null, 'University removed');
}));

module.exports = router;
