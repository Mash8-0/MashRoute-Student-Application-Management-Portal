/**
 * WhatsApp notification orchestrator.
 *
 * Resolves recipients (tenant admin / assigned staff / assigned agent / student),
 * picks the approved template + body variables for an event, sends via the Meta
 * Cloud API, and records every attempt in WhatsAppLog. Designed to be called
 * fire-and-forget so it can NEVER break the application workflow.
 */
const prisma = require('../config/database');
const { sendWhatsAppTemplate, isConfigured, normalizePhone } = require('./whatsapp');

// Event → { template, label, vars(ctx) }. Template names must match approved
// WhatsApp templates in Meta Business Manager. Body params map to {{1}}, {{2}}…
const EVENTS = {
  application_created: { label: 'New application created', vars: (c) => [c.studentName, c.referenceNo, c.universityName] },
  offer_letter_uploaded: { label: 'Offer letter uploaded', vars: (c) => [c.studentName, c.referenceNo, c.universityName] },
  payment_proof_uploaded: { label: 'Payment proof uploaded', vars: (c) => [c.studentName, c.referenceNo] },
  payment_verified: { label: 'Payment verified', vars: (c) => [c.studentName, c.referenceNo] },
  emgs_approved: { label: 'EMGS approved', vars: (c) => [c.studentName, c.referenceNo] },
  eval_approved: { label: 'eVAL approved', vars: (c) => [c.studentName, c.referenceNo] },
  evisa_approved: { label: 'eVisa approved', vars: (c) => [c.studentName, c.referenceNo] },
  arrival_updated: { label: 'Arrival date updated', vars: (c) => [c.studentName, c.referenceNo, c.arrivalDate || '—'] },
  commission_eligible: { label: 'Commission eligible', vars: (c) => [c.studentName, c.referenceNo, c.commission || '—'] },
  commission_paid: { label: 'Commission paid', vars: (c) => [c.studentName, c.referenceNo, c.commission || '—'] },
};

const ALL_RECIPIENT_ROLES = ['TENANT_ADMIN', 'STAFF', 'AGENT', 'STUDENT'];

// Default config used when a tenant hasn't customised anything: everything on.
function resolveConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  const recipients = c.recipients || {};
  const events = c.events || {};
  return {
    recipientOn: (role) => recipients[role] !== false,
    eventOn: (event) => events[event] !== false,
    template: (event) => (c.templates && c.templates[event]) || event,
  };
}

// Gather the distinct recipients for an application, de-duped by phone.
async function resolveRecipients(application, cfg) {
  const out = [];
  const seen = new Set();
  const add = (role, name, phone) => {
    if (!cfg.recipientOn(role)) return;
    const norm = normalizePhone(phone);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push({ role, name: name || null, phone });
  };

  // Tenant admins
  const admins = await prisma.user.findMany({
    where: { tenantId: application.tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null },
    select: { firstName: true, lastName: true, phone: true },
  });
  admins.forEach((a) => add('TENANT_ADMIN', `${a.firstName} ${a.lastName}`.trim(), a.phone));

  // Assigned agent
  if (application.agentId) {
    const agent = await prisma.user.findUnique({ where: { id: application.agentId }, select: { firstName: true, lastName: true, phone: true } });
    if (agent) add('AGENT', `${agent.firstName} ${agent.lastName}`.trim(), agent.phone);
  }
  // Creator (assigned staff), if different from the agent
  if (application.createdById && application.createdById !== application.agentId) {
    const staff = await prisma.user.findUnique({ where: { id: application.createdById }, select: { firstName: true, lastName: true, phone: true } });
    if (staff) add('STAFF', `${staff.firstName} ${staff.lastName}`.trim(), staff.phone);
  }

  // Student (WhatsApp number falls back to phone)
  const student = await prisma.student.findUnique({ where: { id: application.studentId }, select: { fullName: true, whatsapp: true, phone: true } });
  if (student) add('STUDENT', student.fullName, student.whatsapp || student.phone);

  return { recipients: out, studentName: student?.fullName };
}

/**
 * Notify everyone configured for an application event. Never throws.
 * @param {string} event   one of EVENTS keys
 * @param {object} application  must include id, tenantId, studentId, agentId, createdById, referenceNo
 * @param {object} [extra]  extra template context, e.g. { arrivalDate, commission }
 */
async function notifyEvent(event, application, extra = {}) {
  const def = EVENTS[event];
  if (!def || !application?.tenantId) return;

  // Global guard: nothing to do if the server has no credentials.
  if (!isConfigured()) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: application.tenantId },
    select: { name: true, whatsappEnabled: true, whatsappConfig: true },
  });
  if (!tenant?.whatsappEnabled) return;

  const cfg = resolveConfig(tenant.whatsappConfig);
  if (!cfg.eventOn(event)) return;

  const { recipients, studentName } = await resolveRecipients(application, cfg);
  if (!recipients.length) return;

  const templateName = cfg.template(event);
  const ctx = {
    studentName: studentName || application.student?.fullName || 'Student',
    referenceNo: application.referenceNo,
    universityName: application.university?.name || extra.universityName || 'University',
    agencyName: tenant.name,
    arrivalDate: extra.arrivalDate,
    commission: extra.commission,
  };
  const variables = def.vars(ctx);

  await Promise.all(recipients.map(async (r) => {
    const base = {
      tenantId: application.tenantId,
      applicationId: application.id,
      recipientName: r.name,
      recipientPhone: r.phone,
      recipientRole: r.role,
      templateName,
    };
    try {
      const result = await sendWhatsAppTemplate(r.phone, templateName, variables);
      await prisma.whatsAppLog.create({
        data: { ...base, messageStatus: 'SENT', providerResponse: result.response || {}, sentAt: new Date() },
      });
    } catch (err) {
      await prisma.whatsAppLog.create({
        data: {
          ...base,
          messageStatus: 'FAILED',
          providerResponse: err.response || { error: err.message },
        },
      }).catch(() => {});
    }
  }));
}

// Fire-and-forget wrapper — safe to call inline in service methods.
function notify(event, application, extra) {
  notifyEvent(event, application, extra).catch((e) => {
    // Never surface to the caller; just log server-side.
    console.error(`[whatsapp] notify(${event}) failed:`, e?.message || e);
  });
}

module.exports = { notify, notifyEvent, EVENTS, ALL_RECIPIENT_ROLES };
