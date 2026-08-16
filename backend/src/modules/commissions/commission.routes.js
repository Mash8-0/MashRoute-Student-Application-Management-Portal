const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../../config/database');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const { logActivity } = require('../../middleware/activityLog.middleware');
const { uploadToDrive } = require('../../services/driveUpload');
const upload = multer({ dest: 'uploads/temp', limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, ['application/pdf','image/jpeg','image/png'].includes(f.mimetype)) });

function maskName(name) { return String(name || '').split(/\s+/).map((part) => part.length < 2 ? '*' : `${part[0]}${'*'.repeat(Math.min(part.length - 1, 6))}`).join(' '); }
async function linkedAgent(req) {
  const agent = await prisma.agent.findFirst({ where: { tenantId: req.user.tenantId, linkedUserId: req.user.id, type: 'REGISTERED_AGENT', status: 'ACTIVE' } });
  if (!agent) throw { statusCode: 403, message: 'Agent portal access is unavailable' }; return agent;
}
const publicSelect = { id: true, commissionType: true, currency: true, agentCommission: true, bonusAmount: true, eligibilityMilestone: true, status: true, expectedPayoutDate: true, paidAt: true, paymentReference: true, agentInvoiceUrl: true, createdAt: true, university: { select: { id: true, name: true } }, student: { select: { id: true, fullName: true } }, application: { select: { referenceNo: true, program: true, intake: true } } };

router.use(authenticate, tenantContext);
router.get('/mine', authorize('REGISTERED_AGENT'), asyncHandler(async (req, res) => {
  const agent = await linkedAgent(req); const page = Math.max(parseInt(req.query.page) || 1, 1); const limit = Math.min(parseInt(req.query.limit) || 15, 50);
  const where = { tenantId: req.tenantId, agentId: agent.id, student: { sourceAgentId: agent.id }, ...(req.query.status && { status: req.query.status }) };
  const [rows, total] = await Promise.all([prisma.agentCommission.findMany({ where, select: publicSelect, skip: (page-1)*limit, take: limit, orderBy: { createdAt: 'desc' } }), prisma.agentCommission.count({ where })]);
  const fullNames = Boolean((await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { settings: true } }))?.settings?.agentCanViewStudentFullName);
  return ApiResponse.paginated(res, rows.map((r) => ({ ...r, student: { id: r.student.id, reference: r.application?.referenceNo || `MR-${r.student.id.slice(0,8).toUpperCase()}`, name: fullNames ? r.student.fullName : maskName(r.student.fullName) } })), { page, limit, total, totalPages: Math.ceil(total/limit) });
}));
router.get('/mine/:id', authorize('REGISTERED_AGENT'), asyncHandler(async (req, res) => {
  const agent = await linkedAgent(req); const row = await prisma.agentCommission.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, agentId: agent.id, student: { sourceAgentId: agent.id } }, select: publicSelect });
  if (!row) throw { statusCode: 404, message: 'Commission not found' }; row.student = { id: row.student.id, reference: row.application?.referenceNo || `MR-${row.student.id.slice(0,8).toUpperCase()}`, name: maskName(row.student.fullName) }; return ApiResponse.success(res, row);
}));
router.post('/mine/:id/invoice', authorize('REGISTERED_AGENT'), upload.single('file'), logActivity('UPLOAD_INVOICE', 'AgentCommission'), asyncHandler(async (req, res) => {
  const agent = await linkedAgent(req); const row = await prisma.agentCommission.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, agentId: agent.id, student: { sourceAgentId: agent.id }, status: { in: ['ELIGIBLE','CLAIM_SUBMITTED'] } } });
  if (!row || !req.file) throw { statusCode: 400, message: 'Eligible commission and valid invoice are required' }; const stored = await uploadToDrive(req.file, 'agent-invoices');
  return ApiResponse.success(res, await prisma.agentCommission.update({ where: { id: row.id }, data: { agentInvoiceUrl: stored.fileUrl, status: 'CLAIM_SUBMITTED' }, select: publicSelect }), 'Invoice uploaded');
}));
router.get('/', authorize('TENANT_ADMIN','STAFF'), asyncHandler(async (req, res) => ApiResponse.success(res, await prisma.agentCommission.findMany({ where: { tenantId: req.tenantId }, include: { agent: true, student: { select: { id: true, fullName: true } }, university: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }))));
router.post('/', authorize('TENANT_ADMIN','STAFF'), logActivity('CREATE','AgentCommission'), asyncHandler(async (req, res) => {
  const { studentId, agentId } = req.body; const student = await prisma.student.findFirst({ where: { id: studentId, tenantId: req.tenantId, sourceAgentId: agentId, deletedAt: null } }); const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: req.tenantId } });
  if (!student || !agent) throw { statusCode: 400, message: 'Student and source agent do not match' };
  const row = await prisma.agentCommission.create({ data: { tenantId: req.tenantId, studentId, agentId, universityId: req.body.universityId || null, applicationId: req.body.applicationId || null, commissionType: req.body.commissionType || 'CLAIMABLE', currency: req.body.currency || 'MYR', grossCommission: Number(req.body.grossCommission)||0, agentCommission: Number(req.body.agentCommission)||0, tenantCommission: Number(req.body.tenantCommission)||0, bonusAmount: Number(req.body.bonusAmount)||0, eligibilityMilestone: req.body.eligibilityMilestone || null, status: 'NOT_ELIGIBLE', internalNotes: req.body.internalNotes || null, createdByUserId: req.user.id } }); return ApiResponse.created(res, row);
}));
router.patch('/:id/status', authorize('TENANT_ADMIN','STAFF'), logActivity('STATUS_UPDATE','AgentCommission'), asyncHandler(async (req, res) => {
  const allowed = ['NOT_ELIGIBLE','PENDING','ELIGIBLE','APPROVED','SCHEDULED','PAID','REJECTED','CANCELLED']; if (!allowed.includes(req.body.status)) throw { statusCode: 400, message: 'Invalid status' }; const current = await prisma.agentCommission.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }); if (!current) throw { statusCode: 404, message: 'Commission not found' };
  const data = { status: req.body.status, expectedPayoutDate: req.body.expectedPayoutDate ? new Date(req.body.expectedPayoutDate) : undefined, paymentReference: req.body.paymentReference, approvedByUserId: ['APPROVED','SCHEDULED','PAID'].includes(req.body.status) ? req.user.id : undefined, paidAt: req.body.status === 'PAID' ? new Date() : undefined }; return ApiResponse.success(res, await prisma.agentCommission.update({ where: { id: current.id }, data }));
}));
module.exports = router;
module.exports.maskName = maskName;
