const { Resend } = require('resend');
const prisma = require('../config/database');

const DEFAULT_FROM = 'MashRoute Update <noreply@mashroute.com>';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendNotificationEmail({ to, subject, html, text, from, replyTo, attachments }) {
  const recipient = normalizeEmail(to);
  if (!recipient) throw new Error('Recipient email is required');
  if (!isValidEmail(recipient)) throw new Error('Invalid recipient email');
  if (!subject) throw new Error('Email subject is required');

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: from || process.env.MAIL_FROM || DEFAULT_FROM,
    ...(replyTo && { replyTo }),
    to: recipient,
    subject,
    html,
    text,
    ...(attachments?.length && { attachments }),
  });

  if (error) {
    console.error('Resend email error:', {
      message: error.message,
      name: error.name,
    });
    throw new Error(error.message || 'Failed to send email');
  }

  return data;
}

async function resolveStudentCommunicationSender(studentId, tenantId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId }, select: { sourceAgent: { select: { displayName: true, email: true, status: true } }, assignedStaff: { select: { firstName: true, lastName: true, email: true } }, tenant: { select: { name: true, email: true } } } });
  if (!student) throw { statusCode: 404, message: 'Student not found' };
  const verifiedAddress = process.env.STUDENT_MAIL_ADDRESS || 'applications@mashroute.com';
  const identity = student.sourceAgent?.status === 'ACTIVE' ? { name: student.sourceAgent.displayName, replyTo: student.sourceAgent.email } : student.assignedStaff ? { name: `${student.assignedStaff.firstName} ${student.assignedStaff.lastName}`, replyTo: student.assignedStaff.email } : { name: student.tenant.name, replyTo: student.tenant.email };
  return { from: `${identity.name.replace(/[<>]/g, '')} <${verifiedAddress}>`, replyTo: isValidEmail(identity.replyTo) ? identity.replyTo : undefined };
}

async function sendNotificationEmailSafe({ recipients, subject, html, text, attachments }) {
  const uniqueRecipients = [
    ...new Set((recipients || []).map(normalizeEmail).filter(isValidEmail)),
  ];
  const results = [];

  for (let index = 0; index < uniqueRecipients.length; index += 1) {
    const email = uniqueRecipients[index];
    // Resend's default API limit is two requests per second. Space batch
    // recipients so one application event cannot trigger avoidable 429s.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 550));
    try {
      const result = await sendNotificationEmail({ to: email, subject, html, text, attachments });
      results.push({ email, success: true, result });
    } catch (error) {
      console.error('Email notification failed:', {
        email,
        message: error.message,
      });
      results.push({ email, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  isValidEmail,
  sendNotificationEmail,
  sendNotificationEmailSafe,
  resolveStudentCommunicationSender,
};
