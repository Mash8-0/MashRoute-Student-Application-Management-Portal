const express = require('express');
const multer = require('multer');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const service = require('./emgsPayment.service');

const router = express.Router();
const upload = multer({ dest: 'uploads/temp', limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
router.use(authenticate, tenantContext, authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'));

router.get('/accounts', asyncHandler(async (req, res) => ApiResponse.success(res, await service.listAccounts(req.tenantId, req.query))));
router.post('/accounts', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.createAccount(req.tenantId, req.user.id, req.body), 'Payment account created')));
router.get('/accounts/:id/reveal', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.revealAccount(req.params.id, req.tenantId))));
router.patch('/accounts/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.updateAccount(req.params.id, req.tenantId, req.user.id, req.body), 'Payment account updated')));
router.delete('/accounts/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.archiveAccount(req.params.id, req.tenantId, req.user.id), 'Payment account archived')));
router.get('/applications/:applicationId', asyncHandler(async (req, res) => ApiResponse.success(res, await service.summary(req.params.applicationId, req.tenantId, ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(req.user.role)))));
router.post('/applications/:applicationId/setup', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.setup(req.params.applicationId, req.tenantId, req.user.id, req.body), 'EMGS payment opened')));
router.patch('/fees/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.amendFee(req.params.id, req.tenantId, req.user.id, req.body), 'EMGS fee amended')));
router.post('/applications/:applicationId/postpone', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.postpone(req.params.applicationId, req.tenantId, req.user.id), 'EMGS setup postponed')));
router.post('/applications/:applicationId/not-required', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.markNotRequired(req.params.applicationId, req.tenantId, req.user.id, req.body), 'EMGS marked not required')));
router.post('/applications/:applicationId/proofs', upload.single('file'), asyncHandler(async (req, res) => ApiResponse.created(res, await service.submitProof(req.params.applicationId, req.tenantId, req.user.id, req.body, req.file), 'Payment proof submitted')));
router.post('/transactions/:id/review', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.startReview(req.params.id, req.tenantId, req.user.id), 'Payment proof under review')));
router.post('/transactions/:id/verify', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.verify(req.params.id, req.tenantId, req.user.id, req.body), 'Payment verified and receipt created')));
router.post('/transactions/:id/reject', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.reject(req.params.id, req.tenantId, req.user.id, req.body), req.body.requestNewProof ? 'New proof requested' : 'Payment rejected')));
router.post('/transactions/:id/reverse', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), asyncHandler(async (req, res) => ApiResponse.success(res, await service.reverse(req.params.id, req.tenantId, req.user.id, req.body), 'Payment reversal recorded')));

module.exports = router;
