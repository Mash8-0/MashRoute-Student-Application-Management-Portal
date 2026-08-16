const express = require('express');
const router = express.Router();
const service = require('./agent.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const { logActivity } = require('../../middleware/activityLog.middleware');

router.use(authenticate, tenantContext, authorize('TENANT_ADMIN', 'STAFF'));
router.get('/', asyncHandler(async (req, res) => { const r = await service.list(req.tenantId, req.query); return ApiResponse.paginated(res, r.rows, r.pagination); }));
router.get('/:id', asyncHandler(async (req, res) => ApiResponse.success(res, await service.get(req.params.id, req.tenantId))));
router.post('/', logActivity('CREATE', 'Agent'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.create(req.tenantId, req.user.id, req.body), 'Agent created')));
router.patch('/:id', logActivity('UPDATE', 'Agent'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.update(req.params.id, req.tenantId, req.body), 'Agent updated')));
router.patch('/:id/status', logActivity('STATUS_UPDATE', 'Agent'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.status(req.params.id, req.tenantId, req.body.status), 'Agent status updated')));
module.exports = router;
