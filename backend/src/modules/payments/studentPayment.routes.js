const express = require('express');
const multer = require('multer');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const service = require('./studentPayment.service');

const router = express.Router();
const upload = multer({ dest: 'uploads/temp', limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
router.use(authenticate, tenantContext, authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'));

router.get('/applications/:applicationId', asyncHandler(async (req, res) => ApiResponse.success(res, await service.summary(req.params.applicationId, req.tenantId))));
router.post('/applications/:applicationId/sections', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.configure(req.params.applicationId, req.tenantId, req.user.id, req.body), 'Payment section configured')));
router.post('/sections/:sectionId/proofs', upload.single('file'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.submitProof(req.params.sectionId, req.tenantId, req.user.id, req.body, req.file), 'Payment proof submitted')));
router.post('/transactions/:id/review', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.startReview(req.params.id, req.tenantId, req.user.id), 'Payment proof under review')));
router.post('/transactions/:id/cancel-review', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.cancelReview(req.params.id, req.tenantId, req.user.id), 'Payment review cancelled')));
router.post('/transactions/:id/verify', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.verify(req.params.id, req.tenantId, req.user.id, req.body), 'Payment verified and receipt created')));
router.post('/transactions/:id/reject', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.reject(req.params.id, req.tenantId, req.user.id, req.body), req.body.requestNewProof ? 'New proof requested' : 'Payment rejected')));

module.exports = router;
