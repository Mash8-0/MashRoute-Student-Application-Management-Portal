const applicationService = require('./application.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const retryOfferLetterIssuedEmail = asyncHandler(async (req, res) => {
  const result = await applicationService.retryOfferLetterIssuedEmail(
    req.params.id, req.tenantId, req.user.id, req.user.role
  );
  return ApiResponse.success(res, result, 'Offer Letter Issued notification processed');
});

module.exports = { retryOfferLetterIssuedEmail };
