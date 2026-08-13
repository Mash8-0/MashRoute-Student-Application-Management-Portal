const express = require('express');
const router = express.Router();
const extractionService = require('./extraction.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);

router.post('/:documentId/extract', asyncHandler(async (req, res) => {
  const { provider = 'tesseract' } = req.body;
  const result = await extractionService.extractDocument(
    req.params.documentId, req.tenantId, req.user.id, provider
  );
  return ApiResponse.success(res, result, 'Extraction completed');
}));

router.get('/:documentId/logs', asyncHandler(async (req, res) => {
  const logs = await extractionService.getExtractionLogs(req.params.documentId);
  return ApiResponse.success(res, logs);
}));

module.exports = router;
