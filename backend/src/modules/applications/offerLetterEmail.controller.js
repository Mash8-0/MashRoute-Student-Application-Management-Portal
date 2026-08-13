const applicationService = require('./application.service');
const { previewOfferLetterIssued } = require('../../services/offerLetterIssuedNotification');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const previewOfferLetterIssuedEmail = asyncHandler(async (req, res) => {
  const data = await previewOfferLetterIssued({ applicationId: req.params.id, tenantId: req.tenantId, recipientType: String(req.query.recipientType || 'STUDENT').toUpperCase() });
  res.json({ success: true, data });
});
const retryOfferLetterIssuedEmail = asyncHandler(async (req, res) => {
  const result = await applicationService.retryOfferLetterIssuedEmail(
    req.params.id, req.tenantId, req.user.id, req.user.role
  );
  return ApiResponse.success(res, result, 'Offer Letter Issued notification processed');
});

module.exports = { retryOfferLetterIssuedEmail, previewOfferLetterIssuedEmail };
