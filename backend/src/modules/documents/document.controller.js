const documentService = require('./document.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'No file uploaded', 400);
  const document = await documentService.uploadDocument(
    req.tenantId, req.user.id, req.file, req.body
  );
  return ApiResponse.created(res, document, 'Document uploaded successfully');
});

const listDocuments = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const documents = await documentService.listDocuments(req.tenantId, studentId, req.query);
  return ApiResponse.success(res, documents);
});

const getDocument = asyncHandler(async (req, res) => {
  const document = await documentService.getDocument(req.params.id, req.tenantId);
  return ApiResponse.success(res, document);
});

const updateDocumentStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const document = await documentService.updateDocumentStatus(req.params.id, req.tenantId, status, notes);
  return ApiResponse.success(res, document, 'Document status updated');
});

const deleteDocument = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.tenantId);
  return ApiResponse.success(res, null, 'Document deleted');
});

const replaceDocument = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'No file uploaded', 400);
  const document = await documentService.replaceDocument(
    req.params.id, req.tenantId, req.user.id, req.file
  );
  return ApiResponse.success(res, document, 'Document replaced successfully');
});

const listByApplication = asyncHandler(async (req, res) => {
  const documents = await documentService.listByApplication(req.tenantId, req.params.applicationId);
  return ApiResponse.success(res, documents);
});

const verifyDocument = asyncHandler(async (req, res) => {
  const document = await documentService.verifyDocument(
    req.params.id, req.tenantId, req.user.id, req.user.role
  );
  return ApiResponse.success(res, document, 'Document verified');
});

const rejectDocument = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const document = await documentService.rejectDocument(
    req.params.id, req.tenantId, req.user.id, req.user.role, reason
  );
  return ApiResponse.success(res, document, 'Document rejected');
});

module.exports = { uploadDocument, listDocuments, listByApplication, getDocument, updateDocumentStatus, deleteDocument, replaceDocument, verifyDocument, rejectDocument };
