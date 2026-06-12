const loeService = require('./loe.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const generateLOE = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const userRole = req.user.role;
  const loeData = req.body || {};

  const result = await loeService.generateLOE(applicationId, tenantId, userId, userRole, loeData);
  return ApiResponse.success(res, result, 'LOE generated successfully');
});

const getLOE = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const userRole = req.user.role;

  const result = await loeService.getLOE(applicationId, tenantId, userId, userRole);
  return ApiResponse.success(res, result);
});

const uploadLOE = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);

  const { applicationId } = req.params;
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const userRole = req.user.role;
  const loe = await loeService.uploadLOE(applicationId, tenantId, userId, userRole, req.file);
  return ApiResponse.success(res, loe, 'LOE file uploaded successfully');
});

const deleteLOE = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const tenantId = req.tenantId;
  const userRole = req.user.role;

  const result = await loeService.deleteLOE(applicationId, tenantId, userRole);
  return ApiResponse.success(res, result, 'LOE deleted successfully');
});

module.exports = { generateLOE, getLOE, uploadLOE, deleteLOE };
