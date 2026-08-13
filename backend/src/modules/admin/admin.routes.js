const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { isValidEmail, sendNotificationEmail } = require('../../services/emailService');

router.use(authenticate, authorize('SUPER_ADMIN', 'TENANT_ADMIN'));

router.post('/test-email', asyncHandler(async (req, res) => {
  const to = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
  if (!isValidEmail(to)) {
    return ApiResponse.error(res, 'A valid recipient email is required', 400);
  }

  let result;
  try {
    result = await sendNotificationEmail({
      to,
      subject: 'MashRoute Email Notification Test',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;">
          <h2 style="margin:0 0 12px;">MashRoute Email Notification Test</h2>
          <p>Your MashRoute Resend email notification system is working successfully.</p>
          <p style="font-size:12px;color:#64748b;">This is an automated notification from MashRoute.</p>
        </div>
      `,
      text: 'Your MashRoute Resend email notification system is working successfully.\n\nThis is an automated notification from MashRoute.',
    });
  } catch (error) {
    const statusCode = error.message === 'RESEND_API_KEY is missing' ? 400 : 502;
    return ApiResponse.error(res, error.message || 'Failed to send test email', statusCode);
  }

  return ApiResponse.success(res, result, 'Test email sent');
}));

module.exports = router;
