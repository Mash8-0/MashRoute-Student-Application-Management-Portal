const registrationService = require('./registration.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const registerCompany = asyncHandler(async (req, res) => {
  const result = await registrationService.registerCompany(req.body, req.files || {});
  return ApiResponse.created(res, result, 'Registration submitted for approval');
});

module.exports = { registerCompany };
