const express = require('express');
const router = express.Router();
const paymentService = require('../payments/payment.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);

router.get('/', asyncHandler(async (req, res) => {
  const result = await paymentService.listInvoices(req.tenantId, req.query);
  return ApiResponse.paginated(res, result.invoices, result.pagination);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await paymentService.getInvoice(req.params.id, req.tenantId);
  return ApiResponse.success(res, invoice);
}));

router.get('/:id/preview', asyncHandler(async (req, res) => {
  const invoice = await paymentService.previewInvoice(req.params.id, req.tenantId);
  return ApiResponse.success(res, invoice);
}));

router.get('/:id/download', asyncHandler(async (req, res) => {
  const invoice = await paymentService.getInvoice(req.params.id, req.tenantId);
  if (!invoice.pdfUrl) return ApiResponse.error(res, 'Invoice PDF not found', 404);
  return res.redirect(invoice.pdfUrl);
}));

router.patch('/:id', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.updateInvoice(req.params.id, req.tenantId, req.user, req.body);
  return ApiResponse.success(res, invoice, 'Invoice draft updated');
}));

router.post('/:id/generate', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.generateInvoice(req.params.id, req.tenantId, req.user);
  return ApiResponse.success(res, invoice, 'Final invoice generated');
}));

router.post('/:id/amend', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.amendInvoice(req.params.id, req.tenantId, req.user);
  return ApiResponse.success(res, invoice, 'Amendment draft created');
}));

router.post('/:id/cancel', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.cancelInvoice(req.params.id, req.tenantId, req.user, req.body.reason || req.body.notes);
  return ApiResponse.success(res, invoice, 'Invoice cancelled');
}));

router.post('/:id/mark-paid', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.markInvoiceStatus(req.params.id, req.tenantId, req.user, 'PAID');
  return ApiResponse.success(res, invoice, 'Invoice marked paid');
}));

router.post('/:id/mark-unpaid', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.markInvoiceStatus(req.params.id, req.tenantId, req.user, 'UNPAID');
  return ApiResponse.success(res, invoice, 'Invoice marked unpaid');
}));

router.post('/:id/mark-due', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const invoice = await paymentService.markInvoiceStatus(req.params.id, req.tenantId, req.user, 'DUE');
  return ApiResponse.success(res, invoice, 'Invoice marked due');
}));

module.exports = router;
