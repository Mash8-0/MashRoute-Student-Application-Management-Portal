import api from './axios';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
};

// ─── Registration (public) ─────────────────────────────────────────────────────
export const registrationAPI = {
  register: (formData) => api.post('/register-company', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenantAPI = {
  me: () => api.get('/tenants/me'),
  uploadMyLogo: (formData) => api.post('/tenants/me/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateAgentPrivacy: (agentCanViewStudentFullName) => api.patch('/tenants/me/agent-privacy', { agentCanViewStudentFullName }),
  list: (params) => api.get('/tenants', { params }),
  create: (data) =>
    api.post(
      '/tenants',
      data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
    ),
  get: (id) => api.get(`/tenants/${id}`),
  update: (id, data) => api.patch(`/tenants/${id}`, data),
  suspend: (id) => api.patch(`/tenants/${id}/suspend`),
  activate: (id) => api.patch(`/tenants/${id}/activate`),
  delete: (id) => api.delete(`/tenants/${id}`),
  stats: () => api.get('/tenants/stats'),
  listPending: () => api.get('/tenants/pending/list'),
  pendingCount: () => api.get('/tenants/pending/count'),
  approve: (id) => api.patch(`/tenants/${id}/approve`),
  reject: (id, reason) => api.patch(`/tenants/${id}/reject`, { reason }),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const userAPI = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.patch(`/users/${id}`, data),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
  delete: (id) => api.delete(`/users/${id}`),
};

// ─── Students ─────────────────────────────────────────────────────────────────
export const studentAPI = {
  list: (params) => api.get('/students', { params }),
  listDeleted: (params) => api.get('/students/deleted', { params }),
  create: (data) => api.post('/students', data),
  get: (id) => api.get(`/students/${id}`),
  update: (id, data) => api.patch(`/students/${id}`, data),
  transfer: (id, ownerId) => api.patch(`/students/${id}/transfer`, { ownerId }),
  delete: (id) => api.delete(`/students/${id}`),
  restore: (id) => api.patch(`/students/${id}/restore`),
  permanentlyDelete: (id) => api.delete(`/students/${id}/permanent`),
};

export const agentAPI = {
  list: (params) => api.get('/agents', { params }),
  get: (id) => api.get(`/agents/${id}`),
  create: (data) => api.post('/agents', data),
  update: (id, data) => api.patch(`/agents/${id}`, data),
  setStatus: (id, status) => api.patch(`/agents/${id}/status`, { status }),
};

export const agentCommissionAPI = {
  mine: (params) => api.get('/agent-commissions/mine', { params }),
  myDetail: (id) => api.get(`/agent-commissions/mine/${id}`),
  uploadInvoice: (id, data) => api.post(`/agent-commissions/mine/${id}/invoice`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: () => api.get('/agent-commissions'),
  create: (data) => api.post('/agent-commissions', data),
  setStatus: (id, data) => api.patch(`/agent-commissions/${id}/status`, data),
};

// ─── Applications ─────────────────────────────────────────────────────────────
export const applicationAPI = {
  list: (params) => api.get('/applications', { params }),
  listDeleted: (params) => api.get('/applications/deleted', { params }),
  create: (data) => api.post('/applications', data),
  get: (id) => api.get(`/applications/${id}`),
  update: (id, data) => api.patch(`/applications/${id}`, data),
  // Workflow actions
  accept: (id, notes) => api.post(`/applications/${id}/accept`, { notes }),
  updateStatus: (id, status, notes) => api.patch(`/applications/${id}/status`, { status, notes }),
  uploadOfferLetter: (id, formData) => api.post(`/applications/${id}/offer-letter`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  retryOfferLetterIssuedEmail: (id) => api.post(`/applications/${id}/offer-letter-email/retry`),
  previewOfferLetterIssuedEmail: (id, recipientType = 'STUDENT') => api.get(`/applications/${id}/offer-letter-email/preview`, { params: { recipientType } }),
  uploadPaymentProof: (id, formData) => api.post(`/applications/${id}/payment-proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteWorkflowDocument: (id, kind) => api.delete(`/applications/${id}/workflow-document/${kind}`),
  verifyPayment: (id, notes) => api.post(`/applications/${id}/verify-payment`, { notes }),
  issueInvoice: (id, notes) => api.post(`/applications/${id}/issue-invoice`, { notes }),
  updateEmgs: (id, percentage, notes) => api.patch(`/applications/${id}/emgs`, { percentage, notes }),
  // Post-eVAL workflow status (separate from EMGS %): AWAITING_EVISA | EVISA_APPROVED | UNDER_ARRIVAL | ARRIVAL_COMPLETED
  updatePostEval: (id, status) => api.patch(`/applications/${id}/post-eval`, { status }),
  uploadEvisa: (id, formData) => api.post(`/applications/${id}/evisa`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadEmgsApproval: (id, formData) => api.post(`/applications/${id}/emgs-approval`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadEvalApproval: (id, formData) => api.post(`/applications/${id}/eval-approval`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateArrival: (id, formData) => api.patch(`/applications/${id}/arrival`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadTuitionProof: (id, formData) => api.post(`/applications/${id}/tuition-proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  requestTuitionPayment: (id, note) => api.post(`/applications/${id}/tuition-request`, { note }),
  openTuitionPayment: (id, data) => api.post(`/applications/${id}/open-tuition-payment`, data),
  // action: 'verify' | 'reject'; remarks optional (required-ish for reject)
  verifyTuition: (id, { action = 'verify', remarks } = {}) =>
    api.post(`/applications/${id}/verify-tuition`, { action, remarks }),
  // Commission payout status: 'PENDING' | 'ELIGIBLE' | 'PAID'
  setCommissionStatus: (id, status) => api.patch(`/applications/${id}/commission-status`, { status }),
  delete: (id) => api.delete(`/applications/${id}`),
  restore: (id) => api.patch(`/applications/${id}/restore`),
  permanentlyDelete: (id) => api.delete(`/applications/${id}/permanent`),
  getNotes: (id) => api.get(`/applications/${id}/notes`),
  addNote: (id, content, isPrivate) => api.post(`/applications/${id}/notes`, { content, isPrivate }),
  getHistory: (id) => api.get(`/applications/${id}/history`),
};

export const emgsPaymentAPI = {
  listAccounts: (params) => api.get('/emgs-payments/accounts', { params }),
  createAccount: (data) => api.post('/emgs-payments/accounts', data),
  updateAccount: (id, data) => api.patch(`/emgs-payments/accounts/${id}`, data),
  archiveAccount: (id) => api.delete(`/emgs-payments/accounts/${id}`),
  getApplicationPayment: (applicationId) => api.get(`/emgs-payments/applications/${applicationId}`),
  setup: (applicationId, data) => api.post(`/emgs-payments/applications/${applicationId}/setup`, data),
  amendFee: (feeId, data) => api.patch(`/emgs-payments/fees/${feeId}`, data),
  postpone: (applicationId) => api.post(`/emgs-payments/applications/${applicationId}/postpone`),
  notRequired: (applicationId, data) => api.post(`/emgs-payments/applications/${applicationId}/not-required`, data),
  submitProof: (applicationId, data) => api.post(`/emgs-payments/applications/${applicationId}/proofs`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  startReview: (transactionId) => api.post(`/emgs-payments/transactions/${transactionId}/review`),
  verify: (transactionId, data) => api.post(`/emgs-payments/transactions/${transactionId}/verify`, data),
  reject: (transactionId, data) => api.post(`/emgs-payments/transactions/${transactionId}/reject`, data),
  reverse: (transactionId, data) => api.post(`/emgs-payments/transactions/${transactionId}/reverse`, data),
};

// ─── LOE ──────────────────────────────────────────────────────────────────────
export const loeAPI = {
  generate: (applicationId, data) => api.post(`/applications/${applicationId}/loe/generate`, data),
  get: (applicationId) => api.get(`/applications/${applicationId}/loe`),
  upload: (applicationId, formData) => api.post(`/applications/${applicationId}/loe/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (applicationId) => api.delete(`/applications/${applicationId}/loe`),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentAPI = {
  list: (studentId, params) => api.get(`/documents/student/${studentId}`, { params }),
  listByApplication: (applicationId, params) => api.get(`/documents/application/${applicationId}`, { params }),
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  get: (id) => api.get(`/documents/${id}`),
  updateStatus: (id, status, notes) => api.patch(`/documents/${id}/status`, { status, notes }),
  verify: (id) => api.patch(`/documents/${id}/verify`),
  reject: (id, reason) => api.patch(`/documents/${id}/reject`, { reason }),
  replace: (id, formData) => api.put(`/documents/${id}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/documents/${id}`),
  extract: (id, provider = 'tesseract') => api.post(`/extraction/${id}/extract`, { provider }),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentAPI = {
  list: (params) => api.get('/payments', { params }),
  create: (data) => api.post('/payments', data),
  get: (id) => api.get(`/payments/${id}`),
  update: (id, data) => api.patch(`/payments/${id}`, data),
  markPaid: (id, receiptUrl) => api.post(`/payments/${id}/mark-paid`, { receiptUrl }),
  delete: (id) => api.delete(`/payments/${id}`),
  stats: () => api.get('/payments/stats'),
};

// ─── Universities ─────────────────────────────────────────────────────────────
export const universityAPI = {
  list: (params) => api.get('/universities', { params }),
  get: (id) => api.get(`/universities/${id}`),
  create: (data) => api.post('/universities', data),
  update: (id, data) => api.patch(`/universities/${id}`, data),
  uploadLogo: (id, formData) => api.post(`/universities/${id}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // Per-tenant commission rates by agent category (+ release policy)
  getCommissions: (id) => api.get(`/universities/${id}/commissions`),
  setCommissions: (id, rows, policy) => api.put(`/universities/${id}/commissions`, { rows, policy }),
  delete: (id) => api.delete(`/universities/${id}`),
};

export const intakeAPI = {
  available: (params) => api.get('/intakes/available', { params }),
  list: (params) => api.get('/intakes', { params }),
  create: (data) => api.post('/intakes', data),
  update: (id, data) => api.patch(`/intakes/${id}`, data),
  setActive: (id, isActive) => api.patch(`/intakes/${id}/active`, { isActive }),
  bulkActive: (ids, isActive) => api.patch('/intakes/bulk-active', { ids, isActive }),
  duplicate: (id, targetYear) => api.post(`/intakes/${id}/duplicate`, { targetYear }),
  audit: (id) => api.get(`/intakes/${id}/audit`),
  requestApproval: (data) => api.post('/intakes/late-approvals', data),
  listApprovals: (params) => api.get('/intakes/late-approvals', { params }),
  reviewApproval: (id, decision, reviewNotes) => api.patch(`/intakes/late-approvals/${id}`, { decision, reviewNotes }),
  getSetting: () => api.get('/intakes/settings'),
  updateSetting: (minimumInternationalLeadTimeDays) => api.patch('/intakes/settings', { minimumInternationalLeadTimeDays }),
};

// ─── WhatsApp notifications ─────────────────────────────────────────────────────
export const whatsappAPI = {
  getSettings: () => api.get('/whatsapp/settings'),
  updateSettings: (data) => api.patch('/whatsapp/settings', data),
  getLogs: (params) => api.get('/whatsapp/logs', { params }),
  test: (to, template) => api.post('/whatsapp/test', { to, template }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  global: () => api.get('/analytics/global'),
  notifications: () => api.get('/analytics/notifications'),
  markNotificationRead: (id) => api.patch(`/analytics/notifications/${id}/read`),
  markAllRead: () => api.patch('/analytics/notifications/read-all'),
  activityLogs: (params) => api.get('/analytics/activity-logs', { params }),
};
