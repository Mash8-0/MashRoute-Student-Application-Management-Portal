const express = require('express');
const router = express.Router();
const paymentService = require('../payments/payment.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);

router.get('/', asyncHandler(async (req, res) => {
  const result = await paymentService.listInvoiceRequests(req.tenantId, req.query);
  return ApiResponse.paginated(res, result.requests, result.pagination);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const request = await paymentService.getInvoiceRequest(req.params.id, req.tenantId);
  return ApiResponse.success(res, request);
}));

router.post('/:id/approve', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const request = await paymentService.getInvoiceRequest(req.params.id, req.tenantId);
  const payment = await paymentService.verifyPayment(request.paymentId, req.tenantId, req.user, req.body.notes);
  return ApiResponse.success(res, payment, 'Invoice request approved and draft invoice prepared');
}));

router.post('/:id/reject', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const request = await paymentService.rejectInvoiceRequest(req.params.id, req.tenantId, req.user, req.body.reason || req.body.notes);
  return ApiResponse.success(res, request, 'Invoice request rejected');
}));

module.exports = router;
