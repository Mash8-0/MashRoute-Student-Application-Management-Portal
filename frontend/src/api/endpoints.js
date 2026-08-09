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
  create: (data) => api.post('/students', data),
  get: (id) => api.get(`/students/${id}`),
  update: (id, data) => api.patch(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

// ─── Applications ─────────────────────────────────────────────────────────────
export const applicationAPI = {
  list: (params) => api.get('/applications', { params }),
  listMdac: (params) => api.get('/applications/mdac/records', { params }),
  create: (data) => api.post('/applications', data),
  get: (id) => api.get(`/applications/${id}`),
  update: (id, data) => api.patch(`/applications/${id}`, data),
  // Workflow actions
  accept: (id, notes) => api.post(`/applications/${id}/accept`, { notes }),
  updateStatus: (id, status, notes) => api.patch(`/applications/${id}/status`, { status, notes }),
  uploadOfferLetter: (id, formData) => api.post(`/applications/${id}/offer-letter`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadPaymentProof: (id, formData) => api.post(`/applications/${id}/payment-proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
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
  getMdac: (id) => api.get(`/applications/${id}/mdac`),
  markMdacNotRequired: (id, notes) => api.patch(`/applications/${id}/mdac/not-required`, { notes }),
  markMdacSubmitted: (id, notes) => api.post(`/applications/${id}/mdac/submitted`, { notes }),
  uploadMdacProof: (id, formData) => api.post(`/applications/${id}/mdac/proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verifyMdac: (id, data) => api.post(`/applications/${id}/mdac/verify`, data),
  uploadTuitionProof: (id, formData) => api.post(`/applications/${id}/tuition-proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // action: 'verify' | 'reject'; remarks optional (required-ish for reject)
  verifyTuition: (id, { action = 'verify', remarks } = {}) =>
    api.post(`/applications/${id}/verify-tuition`, { action, remarks }),
  // Commission payout status: 'PENDING' | 'ELIGIBLE' | 'PAID'
  setCommissionStatus: (id, status) => api.patch(`/applications/${id}/commission-status`, { status }),
  delete: (id) => api.delete(`/applications/${id}`),
  getNotes: (id) => api.get(`/applications/${id}/notes`),
  addNote: (id, content, isPrivate) => api.post(`/applications/${id}/notes`, { content, isPrivate }),
  getHistory: (id) => api.get(`/applications/${id}/history`),
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
