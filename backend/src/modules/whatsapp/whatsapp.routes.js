const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { EVENTS, ALL_RECIPIENT_ROLES } = require('../../services/whatsappNotify');
const { isConfigured, sendWhatsAppTemplate } = require('../../services/whatsapp');

router.use(authenticate, tenantContext);

// Keep only the recognised, JSON-serialisable parts of a config payload.
function sanitizeConfig(input) {
  const c = input && typeof input === 'object' ? input : {};
  const pickBoolMap = (obj, keys) => {
    const out = {};
    if (obj && typeof obj === 'object') {
      keys.forEach((k) => { if (typeof obj[k] === 'boolean') out[k] = obj[k]; });
    }
    return out;
  };
  return {
    recipients: pickBoolMap(c.recipients, ALL_RECIPIENT_ROLES),
    events: pickBoolMap(c.events, Object.keys(EVENTS)),
    templates: c.templates && typeof c.templates === 'object'
      ? Object.fromEntries(Object.entries(c.templates).filter(([k, v]) => EVENTS[k] && typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim()]))
      : {},
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { whatsappEnabled: true, whatsappConfig: true },
  });
  return ApiResponse.success(res, {
    enabled: tenant?.whatsappEnabled || false,
    config: tenant?.whatsappConfig || {},
    providerReady: isConfigured(),
    events: Object.entries(EVENTS).map(([key, v]) => ({ key, label: v.label })),
    roles: ALL_RECIPIENT_ROLES,
  });
}));

router.patch('/settings', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const data = {};
  if (typeof req.body.enabled === 'boolean') data.whatsappEnabled = req.body.enabled;
  if (req.body.config !== undefined) data.whatsappConfig = sanitizeConfig(req.body.config);

  const tenant = await prisma.tenant.update({
    where: { id: req.tenantId },
    data,
    select: { whatsappEnabled: true, whatsappConfig: true },
  });
  return ApiResponse.success(res, {
    enabled: tenant.whatsappEnabled,
    config: tenant.whatsappConfig || {},
    providerReady: isConfigured(),
  }, 'WhatsApp settings updated');
}));

// ─── Logs ───────────────────────────────────────────────────────────────────
router.get('/logs', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = {
    tenantId: req.tenantId,
    ...(req.query.status && { messageStatus: req.query.status }),
    ...(req.query.applicationId && { applicationId: req.query.applicationId }),
  };
  const [logs, total] = await Promise.all([
    prisma.whatsAppLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.whatsAppLog.count({ where }),
  ]);
  return ApiResponse.paginated(res, logs, getPaginationMeta(total, page, limit));
}));

// ─── Test send ────────────────────────────────────────────────────────────────
// Sends an approved template (default "hello_world") to verify configuration.
router.post('/test', authorize('TENANT_ADMIN'), asyncHandler(async (req, res) => {
  const { to, template } = req.body;
  if (!to) return ApiResponse.error(res, 'Recipient number (to) is required', 400);
  if (!isConfigured()) return ApiResponse.error(res, 'WhatsApp is not configured on the server', 400);

  const templateName = template || 'hello_world';
  const lang = templateName === 'hello_world' ? 'en_US' : undefined;
  const base = {
    tenantId: req.tenantId,
    recipientName: 'Test',
    recipientPhone: String(to),
    recipientRole: 'TENANT_ADMIN',
    templateName,
  };
  try {
    const result = await sendWhatsAppTemplate(to, templateName, [], lang ? { lang } : {});
    await prisma.whatsAppLog.create({ data: { ...base, messageStatus: 'SENT', providerResponse: result.response || {}, sentAt: new Date() } });
    return ApiResponse.success(res, result.response, 'Test message sent');
  } catch (err) {
    await prisma.whatsAppLog.create({ data: { ...base, messageStatus: 'FAILED', providerResponse: err.response || { error: err.message } } }).catch(() => {});
    return ApiResponse.error(res, err.message || 'Failed to send test message', 400);
  }
}));

module.exports = router;
