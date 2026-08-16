const service = require('./intake.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

exports.available = asyncHandler(async (req, res) => ApiResponse.success(res, await service.list(req.tenantId, req.query, true, req.user.id)));
exports.list = asyncHandler(async (req, res) => ApiResponse.success(res, await service.list(req.tenantId, req.query, false)));
exports.create = asyncHandler(async (req, res) => ApiResponse.created(res, await service.create(req.tenantId, req.user.id, req.body), 'Intake created'));
exports.update = asyncHandler(async (req, res) => ApiResponse.success(res, await service.update(req.params.id, req.tenantId, req.user.id, req.body), 'Intake updated'));
exports.setActive = asyncHandler(async (req, res) => ApiResponse.success(res, await service.setActive(req.params.id, req.tenantId, req.user.id, req.body.isActive), req.body.isActive ? 'Intake reopened' : 'Intake archived'));
exports.bulkActive = asyncHandler(async (req, res) => ApiResponse.success(res, await service.bulkActive(req.tenantId, req.user.id, req.body.ids, req.body.isActive), 'Intakes updated'));
exports.duplicate = asyncHandler(async (req, res) => ApiResponse.created(res, await service.duplicate(req.params.id, req.tenantId, req.user.id, req.body.targetYear), 'Intake duplicated'));
exports.audit = asyncHandler(async (req, res) => ApiResponse.success(res, await service.audit(req.params.id, req.tenantId)));
exports.requestApproval = asyncHandler(async (req, res) => ApiResponse.created(res, await service.requestApproval(req.tenantId, req.user, req.body), 'Approval requested'));
exports.listApprovals = asyncHandler(async (req, res) => ApiResponse.success(res, await service.listApprovals(req.tenantId, req.query.status)));
exports.reviewApproval = asyncHandler(async (req, res) => ApiResponse.success(res, await service.reviewApproval(req.params.id, req.tenantId, req.user.id, req.body.decision, req.body.reviewNotes), 'Approval reviewed'));
exports.getSetting = asyncHandler(async (req, res) => ApiResponse.success(res, await service.getSetting(req.tenantId)));
exports.updateSetting = asyncHandler(async (req, res) => ApiResponse.success(res, await service.updateSetting(req.tenantId, req.body.minimumInternationalLeadTimeDays), 'Lead time updated'));
