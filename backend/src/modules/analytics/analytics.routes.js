const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext, authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'));

// Tenant dashboard analytics
router.get('/dashboard', asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  // SUPER_ADMIN has tenantId null → omit tenant filter to aggregate across all tenants
  const t = tenantId ? { tenantId } : {};

  const [
    totalStudents,
    totalApplications,
    applicationsByStatus,
    recentApplications,
    paymentStats,
    agentPerformance,
    monthlyApplications,
  ] = await Promise.all([
    prisma.student.count({ where: { ...t, deletedAt: null } }),
    prisma.application.count({ where: { ...t, deletedAt: null } }),
    prisma.application.groupBy({
      by: ['status'],
      where: { ...t, deletedAt: null },
      _count: { status: true },
    }),
    prisma.application.findMany({
      where: { ...t, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        student: { select: { fullName: true } },
        university: { select: { name: true } },
      },
    }),
    prisma.payment.aggregate({
      where: { ...t, status: 'PAID' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { ...t, role: 'STAFF', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { assignedApplications: true } },
      },
    }),
    // Last 6 months application volume (tenant-scoped when applicable)
    tenantId
      ? prisma.$queryRaw`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
            CAST(COUNT(*) AS INTEGER) as count
          FROM "Application"
          WHERE "tenantId" = ${tenantId}
            AND "deletedAt" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY DATE_TRUNC('month', "createdAt")
        `
      : prisma.$queryRaw`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as month,
            CAST(COUNT(*) AS INTEGER) as count
          FROM "Application"
          WHERE "deletedAt" IS NULL
            AND "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY DATE_TRUNC('month', "createdAt")
        `,
  ]);

  const statusMap = applicationsByStatus.reduce((acc, item) => {
    acc[item.status] = item._count.status;
    return acc;
  }, {});

  return ApiResponse.success(res, {
    overview: {
      totalStudents,
      totalApplications,
      totalRevenue: paymentStats._sum.amount || 0,
      paidInvoices: paymentStats._count.id,
      pending: statusMap.DRAFT || 0,
      approved: statusMap.VISA_APPROVED || 0,
      completed: statusMap.COMPLETED || 0,
      rejected: statusMap.REJECTED || 0,
    },
    applicationsByStatus,
    recentApplications,
    agentPerformance,
    monthlyApplications,
  });
}));

// Super admin global stats
router.get('/global', authorize('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const [
    totalTenants,
    activeTenants,
    totalUsers,
    totalStudents,
    totalApplications,
    byPlan,
    recentTenants,
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.application.count({ where: { deletedAt: null } }),
    prisma.tenant.groupBy({
      by: ['plan'],
      where: { deletedAt: null },
      _count: { plan: true },
    }),
    prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, status: true, plan: true, createdAt: true },
    }),
  ]);

  return ApiResponse.success(res, {
    overview: { totalTenants, activeTenants, totalUsers, totalStudents, totalApplications },
    byPlan,
    recentTenants,
  });
}));

// Notifications
router.get('/notifications', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ApiResponse.success(res, notifications);
}));

router.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { isRead: true, readAt: new Date() },
  });
  return ApiResponse.success(res, null, 'Notification marked as read');
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return ApiResponse.success(res, null, 'All notifications marked as read');
}));

// Activity log
router.get('/activity-logs', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = req.user.role === 'SUPER_ADMIN'
    ? {}
    : { tenantId: req.tenantId };

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: parseInt(limit),
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
  });

  return ApiResponse.success(res, logs);
}));

module.exports = router;
