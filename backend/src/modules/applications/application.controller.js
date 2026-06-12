const applicationService = require('./application.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getIO = (req) => req.app.get('io');

const createApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.createApplication(
    req.tenantId, req.user.id, req.body, getIO(req)
  );
  return ApiResponse.created(res, application, 'Application created successfully');
});

const listApplications = asyncHandler(async (req, res) => {
  const result = await applicationService.listApplications(
    req.tenantId, req.query, req.user.id, req.user.role
  );
  return ApiResponse.paginated(res, result.applications, result.pagination);
});

const getApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.getApplication(
    req.params.id, req.tenantId, req.user.id, req.user.role
  );
  return ApiResponse.success(res, application);
});

const updateApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.updateApplication(
    req.params.id, req.tenantId, req.body
  );
  return ApiResponse.success(res, application, 'Application updated');
});

const acceptApplication = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const application = await applicationService.acceptApplication(
    req.params.id, req.tenantId, req.user.id, req.user.role, notes, getIO(req)
  );
  return ApiResponse.success(res, application, 'Application accepted');
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  if (!status) return ApiResponse.error(res, 'Status is required', 400);
  const application = await applicationService.updateStatus(
    req.params.id, req.tenantId, req.user.id, req.user.role, status, notes, getIO(req)
  );
  return ApiResponse.success(res, application, `Status updated to ${status}`);
});

const uploadOfferLetter = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadOfferLetter(
    req.params.id, req.tenantId, req.user.id, req.user.role, req.file
  );
  return ApiResponse.success(res, application, 'Offer Letter uploaded successfully');
});

const uploadPaymentProof = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadPaymentProof(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, application, 'Payment proof uploaded successfully');
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const application = await applicationService.verifyPayment(
    req.params.id, req.tenantId, req.user.id, req.user.role, notes
  );
  return ApiResponse.success(res, application, 'Payment verified');
});

const issueInvoice = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const application = await applicationService.issueInvoice(
    req.params.id, req.tenantId, req.user.id, req.user.role, notes, getIO(req)
  );
  return ApiResponse.success(res, application, 'Invoice issued — EMGS workflow started');
});

const updateEmgsProgress = asyncHandler(async (req, res) => {
  const { percentage, notes } = req.body;
  if (percentage === undefined || percentage === null) {
    return ApiResponse.error(res, 'percentage is required', 400);
  }
  const application = await applicationService.updateEmgsProgress(
    req.params.id, req.tenantId, req.user.id, req.user.role, percentage, notes, getIO(req)
  );
  return ApiResponse.success(res, application, `EMGS progress updated to ${percentage}%`);
});

const updatePostEvalStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return ApiResponse.error(res, 'status is required', 400);
  const application = await applicationService.updatePostEvalStatus(
    req.params.id, req.tenantId, req.user.id, req.user.role, status, getIO(req)
  );
  return ApiResponse.success(res, application, 'Post-eVAL status updated');
});

const updateArrival = asyncHandler(async (req, res) => {
  const { arrivalDate, flightDate } = req.body;
  const application = await applicationService.updateArrival(
    req.params.id, req.tenantId, req.user.id, req.user.role, { arrivalDate, flightDate }, req.file
  );
  return ApiResponse.success(res, application, 'Arrival updated');
});

const uploadEvisa = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadEvisa(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, application, 'eVisa uploaded successfully');
});

const uploadEmgsApproval = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadEmgsApproval(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, application, 'EMGS approval letter uploaded successfully');
});

const uploadEvalApproval = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadEvalApproval(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, application, 'eVAL approval letter uploaded successfully');
});

const uploadTuitionProof = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'File is required', 400);
  const application = await applicationService.uploadTuitionProof(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, application, 'Tuition payment proof uploaded successfully');
});

const verifyTuition = asyncHandler(async (req, res) => {
  const { action, remarks, notes } = req.body;
  const application = await applicationService.verifyTuition(
    req.params.id, req.tenantId, req.user.id, req.user.role,
    { action, remarks: remarks ?? notes }
  );
  const msg = action === 'reject' ? 'Tuition payment rejected' : 'Tuition payment verified';
  return ApiResponse.success(res, application, msg);
});

const setCommissionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const application = await applicationService.setCommissionStatus(
    req.params.id, req.tenantId, req.user.role, status
  );
  return ApiResponse.success(res, application, `Commission marked ${String(status || '').toLowerCase()}`);
});

const addNote = asyncHandler(async (req, res) => {
  const { content, isPrivate } = req.body;
  if (!content) return ApiResponse.error(res, 'Note content is required', 400);
  const note = await applicationService.addNote(
    req.params.id, req.tenantId, req.user.id, content, isPrivate, getIO(req)
  );
  return ApiResponse.created(res, note, 'Note added');
});

const getNotes = asyncHandler(async (req, res) => {
  const notes = await applicationService.getNotes(
    req.params.id, req.tenantId, req.user.id, req.user.role
  );
  return ApiResponse.success(res, notes);
});

const getStatusHistory = asyncHandler(async (req, res) => {
  const history = await applicationService.getStatusHistory(req.params.id, req.tenantId);
  return ApiResponse.success(res, history);
});

const deleteApplication = asyncHandler(async (req, res) => {
  await applicationService.deleteApplication(req.params.id, req.tenantId, req.user.role);
  return ApiResponse.success(res, null, 'Application deleted');
});

module.exports = {
  createApplication, listApplications, getApplication, updateApplication,
  acceptApplication, updateStatus, uploadOfferLetter, uploadPaymentProof,
  verifyPayment, issueInvoice, updateEmgsProgress, updatePostEvalStatus,
  updateArrival, uploadEvisa, uploadEmgsApproval, uploadEvalApproval,
  uploadTuitionProof, verifyTuition, setCommissionStatus,
  addNote, getNotes, getStatusHistory, deleteApplication,
};
