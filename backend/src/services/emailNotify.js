const prisma = require('../config/database');
const { sendNotificationEmailSafe } = require('./emailService');

const EVENT_DEFS = {
  payment_proof_uploaded: {
    title: 'Payment Proof Uploaded',
    subject: 'MashRoute: Payment Proof Uploaded',
    roles: ['STUDENT', 'ASSIGNED', 'TENANT_ADMIN'],
    message: 'Payment proof has been uploaded and is ready for admin review.',
  },
  payment_verified: {
    title: 'Payment Verified',
    subject: 'MashRoute: Payment Verified',
    roles: ['STUDENT', 'ASSIGNED'],
    message: 'The payment proof has been verified successfully.',
  },
  emgs_approved: {
    title: 'EMGS Approved',
    subject: 'MashRoute: EMGS Approved',
    roles: ['STUDENT', 'ASSIGNED'],
    message: 'The EMGS approval document has been uploaded.',
  },
  eval_approved: {
    title: 'eVAL Approved',
    subject: 'MashRoute: eVAL Approved',
    roles: ['STUDENT', 'ASSIGNED'],
    message: 'The eVAL approval document has been uploaded.',
  },
  evisa_approved: {
    title: 'eVisa Approved',
    subject: 'MashRoute: eVisa Approved',
    roles: ['STUDENT', 'ASSIGNED', 'TENANT_ADMIN'],
    message: 'The eVisa document has been uploaded for this application.',
  },
  flight_ticket_uploaded: {
    title: 'Flight Ticket Uploaded',
    subject: 'MashRoute: Flight Ticket Uploaded',
    roles: ['STUDENT', 'ASSIGNED', 'TENANT_ADMIN'],
    message: 'The flight ticket has been uploaded for this application.',
  },
  arrival_payment_verified: {
    title: 'Arrival Payment Verified',
    subject: 'MashRoute: Arrival Payment Verified',
    roles: ['STUDENT', 'ASSIGNED'],
    message: 'The arrival tuition payment has been verified successfully.',
  },
  application_successful: {
    title: 'Application Successful',
    subject: 'MashRoute: Application Successful',
    roles: ['STUDENT', 'ASSIGNED', 'TENANT_ADMIN'],
    message: 'This application has been completed successfully.',
  },
  application_status_updated: {
    title: 'Application Status Updated',
    subject: 'MashRoute: Application Status Updated',
    roles: ['STUDENT', 'ASSIGNED'],
    message: 'Your application has moved to the next stage.\nYou can review the latest details below.',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function labelStatus(status) {
  return String(status || 'Updated').replace(/_/g, ' ');
}

function getDashboardUrl(applicationId) {
  const base = process.env.FRONTEND_URL || process.env.APP_URL || 'https://mashroute.com';
  return `${base.replace(/\/$/, '')}/applications/${applicationId}`;
}

function createApplicationNotificationTemplate({
  title,
  message,
  studentName,
  passportNumber,
  universityName,
  programName,
  status,
  dashboardUrl,
}) {
  const rows = [
    ['Student', studentName],
    ['Passport', passportNumber],
    ['University', universityName],
    ['Program', programName],
    ['Status', labelStatus(status)],
  ].filter(([, value]) => value);

  const detailRows = rows.map(([label, value], index) => {
    const isLast = index === rows.length - 1;
    return `
    <tr>
      <td class="detailLabel${isLast ? ' lastDetail' : ''}" width="31%" style="width:31%;padding:6px 12px${isLast ? ' 14px' : ''};color:#CBD5E1;font-size:13px;font-weight:700;line-height:1.35;text-align:left;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
      <td class="detailValue${isLast ? ' lastDetail' : ''}" width="69%" style="width:69%;padding:6px 12px${isLast ? ' 14px' : ''};color:#F8FAFC;font-size:13px;font-weight:700;line-height:1.35;text-align:left;vertical-align:top;word-break:break-word;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-size:inherit;line-height:inherit;"><tr><td width="16" style="width:16px;color:#F8FAFC;font-weight:700;text-align:left;vertical-align:top;">:</td><td style="color:#F8FAFC;font-weight:700;text-align:left;vertical-align:top;word-break:break-word;">${escapeHtml(value)}</td></tr></table></td>
    </tr>
  `;
  }).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@supports (-webkit-background-clip:text){.gradientText{background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important}}@media only screen and (max-width:640px){.shell{padding:4px!important}.card{border-radius:14px!important}.pad{padding-left:14px!important;padding-right:14px!important}.brand{font-size:17px!important}.heading{font-size:20px!important}.message{font-size:12px!important;line-height:1.5!important}.statusPill{font-size:11px!important}.details{width:80%!important}.detailLabel{width:31%!important;padding:4px 8px!important;font-size:10px!important}.detailValue{padding:4px 8px!important;font-size:11px!important}.lastDetail{padding-bottom:10px!important}.cta{width:160px!important;max-width:68%!important}.ctaLink{padding:11px 8px!important;font-size:11px!important}.footer{font-size:10px!important}}</style></head>
<body style="margin:0;padding:0;width:100%;overflow-x:hidden;background:#020B1D;color:#CBD5E1;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(message)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;background:#020B1D;"><tr><td class="shell" align="center" style="padding:12px 8px;">
<table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#06132A;border:2px solid #10D9F5;border-radius:20px;overflow:hidden;box-sizing:border-box;box-shadow:0 0 30px rgba(35,136,255,.2);">
<tr><td class="pad" style="padding:22px 20px 24px;text-align:center;">
<div style="display:inline-block;margin:0 0 12px;padding:6px 12px;border:1px solid #2388FF;border-radius:999px;color:#10D9F5;font-size:11px;font-weight:700;letter-spacing:.7px;">APPLICATION UPDATE</div>
<h1 class="heading" style="margin:0;color:#F8FAFC;font-size:27px;line-height:1.2;"><span class="gradientText" style="color:#10D9F5;">${escapeHtml(title)}</span></h1>
<p class="message" style="margin:14px auto 12px;max-width:500px;color:#CBD5E1;font-size:14px;line-height:1.6;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
${status ? `<table class="statusPill" role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;"><tr><td style="padding:1px;border-radius:999px;background:#2388FF;background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);box-shadow:0 0 14px rgba(35,136,255,.32);"><table role="presentation" cellpadding="0" cellspacing="0" style="background:#0B2040;border-radius:999px;"><tr><td width="38" align="right" valign="middle" style="width:38px;padding:7px 0 7px 11px;color:#10D9F5;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;line-height:16px;text-align:right;white-space:nowrap;text-shadow:0 0 7px #10D9F5;">&#9679; )))</td><td valign="middle" style="padding:7px 13px 7px 8px;color:#F8FAFC;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;line-height:16px;letter-spacing:.5px;vertical-align:middle;white-space:nowrap;"><strong style="color:#F8FAFC;font-weight:800;">${escapeHtml(labelStatus(status))}</strong></td></tr></table></td></tr></table>` : ''}
<table class="details" role="presentation" width="80%" align="center" cellpadding="0" cellspacing="0" style="width:80%;margin:0 auto 20px;background:#08172E;border:1px solid #334561;border-radius:16px;">
<tr><td colspan="2" align="center" style="padding:12px 16px 9px;border-bottom:1px solid #334561;color:#10D9F5;font-size:16px;font-weight:900;line-height:1.2;text-align:center;"><span class="gradientText" style="color:#10D9F5;font-weight:900;">APPLICATION DETAILS</span></td></tr>${detailRows}</table>
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;"><tr><td style="border-top:1px solid #2388FF;line-height:1px;">&nbsp;</td><td width="32" style="color:#10D9F5;font-size:16px;">&#10022;</td><td style="border-top:1px solid #8B2CF5;line-height:1px;">&nbsp;</td></tr></table>
<p class="footer" style="margin:12px 0 0;color:#CBD5E1;font-size:12px;line-height:1.5;">This is an automated email. No reply is required.</p><p class="footer" style="margin:16px 0 2px;color:#CBD5E1;font-size:11px;">MashRoute | Student Application Management Portal</p><p class="footer" style="margin:0;color:#94A3B8;font-size:11px;">Simplifying Every Step of the Student Journey</p>
</td></tr></table></td></tr></table></body></html>`;
}

function createTextNotification({ title, message, studentName, passportNumber, universityName, programName, status, dashboardUrl }) {
  return [
    `MashRoute - ${title}`,
    '',
    message,
    '',
    studentName ? `Student: ${studentName}` : null,
    passportNumber ? `Passport: ${passportNumber}` : null,
    universityName ? `University: ${universityName}` : null,
    programName ? `Program: ${programName}` : null,
    status ? `Status: ${labelStatus(status)}` : null,
    dashboardUrl ? `Dashboard: ${dashboardUrl}` : null,
    '',
    'This is an automated notification from MashRoute.',
  ].filter((line) => line !== null).join('\n');
}

async function getApplicationContext(application) {
  if (!application?.id) return null;
  return prisma.application.findUnique({
    where: { id: application.id },
    include: {
      tenant: { select: { id: true, name: true } },
      student: {
        select: {
          fullName: true,
          passportNumber: true,
          email: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      university: { select: { name: true } },
      agent: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

async function getTenantAdminEmails(tenantId) {
  if (!tenantId) return [];
  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'TENANT_ADMIN', isActive: true, deletedAt: null },
    select: { email: true },
  });
  return admins.map((admin) => admin.email);
}

async function resolveRecipients(app, roles) {
  const recipients = [];
  if (roles.includes('STUDENT')) recipients.push(app.student?.email);
  if (roles.includes('ASSIGNED')) {
    recipients.push(app.agent?.email);
    if (app.createdBy?.id !== app.agent?.id) recipients.push(app.createdBy?.email);
    if (
      app.student?.createdBy?.id !== app.agent?.id &&
      app.student?.createdBy?.id !== app.createdBy?.id
    ) {
      recipients.push(app.student?.createdBy?.email);
    }
  }
  if (roles.includes('TENANT_ADMIN')) {
    recipients.push(...await getTenantAdminEmails(app.tenantId));
  }
  return recipients;
}

async function notifyEvent(event, application, extra = {}) {
  const def = EVENT_DEFS[event];
  if (!def || !application?.id) return [];

  const app = await getApplicationContext(application);
  if (!app) return [];

  const roles = [...def.roles];
  if (event === 'application_status_updated' && extra.notifyTenantAdmin) {
    roles.push('TENANT_ADMIN');
  }

  const recipients = await resolveRecipients(app, roles);
  const title = extra.title || def.title;
  const status = extra.status || app.status;
  const message = extra.message || def.message;
  const dashboardUrl = extra.dashboardUrl || getDashboardUrl(app.id);
  const payload = {
    title,
    message,
    studentName: app.student?.fullName,
    passportNumber: app.student?.passportNumber,
    universityName: app.university?.name,
    programName: app.program,
    status,
    dashboardUrl,
  };

  return sendNotificationEmailSafe({
    recipients,
    subject: extra.subject || def.subject,
    html: createApplicationNotificationTemplate(payload),
    text: createTextNotification(payload),
    attachments: extra.attachments,
  });
}

function notify(event, application, extra) {
  notifyEvent(event, application, extra).catch((error) => {
    console.error(`[email] notify(${event}) failed:`, error?.message || error);
  });
}

module.exports = {
  notify,
  notifyEvent,
  createApplicationNotificationTemplate,
  createTextNotification,
};
