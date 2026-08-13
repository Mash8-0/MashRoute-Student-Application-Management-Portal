const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const controller = require('./application.controller');
const offerLetterEmailController = require('./offerLetterEmail.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const { logActivity } = require('../../middleware/activityLog.middleware');

router.use(authenticate, tenantContext, authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF'));

// ─── Multer (for offer letter + payment proof uploads) ────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

// ─── Core CRUD ────────────────────────────────────────────────────────────────

router.get('/', controller.listApplications);
router.post('/', logActivity('CREATE', 'Application'), controller.createApplication);

// MDAC arrival/reminder management list must be registered before /:id.
router.get('/mdac/records', controller.listMdacRecords);

router.get('/:id', controller.getApplication);

// Edit: TENANT_ADMIN + SUPER_ADMIN (STAFF edits own via the same route — restricted in service via agentId)
router.patch('/:id', logActivity('UPDATE', 'Application'), controller.updateApplication);

// Delete: TENANT_ADMIN only (enforced in service + route guard)
router.delete('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), logActivity('DELETE', 'Application'), controller.deleteApplication);

// ─── Workflow Actions ─────────────────────────────────────────────────────────

// Accept: TENANT_ADMIN only (enforced in service)
router.post('/:id/accept', logActivity('ACCEPT', 'Application'), controller.acceptApplication);

// Status update: TENANT_ADMIN only (enforced in service)
router.patch('/:id/status', logActivity('STATUS_UPDATE', 'Application'), controller.updateStatus);

// Offer Letter upload: TENANT_ADMIN only (enforced in service)
router.post('/:id/offer-letter', upload.single('file'), logActivity('UPLOAD_OFFER_LETTER', 'Application'), controller.uploadOfferLetter);
router.get('/:id/offer-letter-email/preview', authorize('TENANT_ADMIN', 'SUPER_ADMIN', 'STAFF'), offerLetterEmailController.previewOfferLetterIssuedEmail);
router.post('/:id/offer-letter-email/retry', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), logActivity('RETRY_OFFER_LETTER_EMAIL', 'Application'), offerLetterEmailController.retryOfferLetterIssuedEmail);

// Payment proof: all authenticated users (enforced in service for pre-conditions)
router.post('/:id/payment-proof', upload.single('file'), logActivity('UPLOAD_PAYMENT_PROOF', 'Application'), controller.uploadPaymentProof);

// Verify payment: TENANT_ADMIN only (enforced in service)
router.post('/:id/verify-payment', logActivity('VERIFY_PAYMENT', 'Application'), controller.verifyPayment);

// Issue invoice: TENANT_ADMIN only (enforced in service)
router.post('/:id/issue-invoice', logActivity('ISSUE_INVOICE', 'Application'), controller.issueInvoice);

// EMGS progress: TENANT_ADMIN only (enforced in service)
router.patch('/:id/emgs', logActivity('UPDATE_EMGS', 'Application'), controller.updateEmgsProgress);

// Post-eVAL workflow status: TENANT_ADMIN only (enforced in service)
router.patch('/:id/post-eval', logActivity('UPDATE_POST_EVAL', 'Application'), controller.updatePostEvalStatus);

// eVisa upload: all authenticated users (Staff/Agent + Admin)
router.post('/:id/evisa', upload.single('file'), logActivity('UPLOAD_EVISA', 'Application'), controller.uploadEvisa);

// EMGS approval letter upload (Awaiting eVisa stage): all authenticated users
router.post('/:id/emgs-approval', upload.single('file'), logActivity('UPLOAD_EMGS_APPROVAL', 'Application'), controller.uploadEmgsApproval);

// eVAL approval letter upload (Awaiting eVisa stage): all authenticated users
router.post('/:id/eval-approval', upload.single('file'), logActivity('UPLOAD_EVAL_APPROVAL', 'Application'), controller.uploadEvalApproval);

// Arrival: all authenticated users (flight ticket upload + arrival date)
router.patch('/:id/arrival', upload.single('file'), logActivity('UPDATE', 'Application'), controller.updateArrival);

// MDAC tracking actions.
router.get('/:id/mdac', controller.getMdacEligibility);
router.patch('/:id/mdac/not-required', logActivity('MDAC_NOT_REQUIRED', 'Application'), controller.markMdacNotRequired);
router.post('/:id/mdac/submitted', logActivity('MDAC_SUBMITTED', 'Application'), controller.markMdacSubmitted);
router.post('/:id/mdac/proof', upload.single('file'), logActivity('MDAC_PROOF_UPLOADED', 'Application'), controller.uploadMdacProof);
router.post('/:id/mdac/verify', logActivity('MDAC_VERIFIED', 'Application'), controller.verifyMdac);

// Tuition payment proof: all authenticated users
router.post('/:id/tuition-proof', upload.single('file'), logActivity('UPLOAD_TUITION_PROOF', 'Application'), controller.uploadTuitionProof);

// Verify tuition payment: TENANT_ADMIN only (enforced in service)
router.post('/:id/verify-tuition', logActivity('VERIFY_TUITION', 'Application'), controller.verifyTuition);

// Commission payout status: TENANT_ADMIN only (enforced in service)
router.patch('/:id/commission-status', logActivity('UPDATE', 'Application'), controller.setCommissionStatus);

// ─── Notes & History ──────────────────────────────────────────────────────────

router.get('/:id/notes', controller.getNotes);
router.post('/:id/notes', logActivity('ADD_NOTE', 'Application'), controller.addNote);
router.get('/:id/history', controller.getStatusHistory);

module.exports = router;
