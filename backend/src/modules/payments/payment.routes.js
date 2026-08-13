const express = require('express');
const multer = require('multer');
const router = express.Router();
const paymentService = require('./payment.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

const upload = multer({ dest: 'uploads/temp', limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate, tenantContext, authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'));

router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await paymentService.getPaymentStats(req.tenantId);
  return ApiResponse.success(res, stats);
}));

router.get('/', asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.tenantId, req.query);
  return ApiResponse.paginated(res, result.payments, result.pagination);
}));

router.post('/', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(req.tenantId, req.body);
  return ApiResponse.created(res, payment, 'Invoice created');
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const payment = await paymentService.getPayment(req.params.id, req.tenantId);
  return ApiResponse.success(res, payment);
}));

router.patch('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const payment = await paymentService.updatePayment(req.params.id, req.tenantId, req.body);
  return ApiResponse.success(res, payment, 'Payment updated');
}));

router.post('/:id/mark-paid', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const payment = await paymentService.markAsPaid(req.params.id, req.tenantId, req.body.receiptUrl);
  return ApiResponse.success(res, payment, 'Payment marked as paid');
}));

router.delete('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req, res) => {
  await paymentService.deletePayment(req.params.id, req.tenantId);
  return ApiResponse.success(res, null, 'Payment deleted');
}));

module.exports = router;
