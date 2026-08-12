const path = require('path');

const EVENT_TYPE = 'OFFER_LETTER_ISSUED';
const DEFAULT_LOGO_URL = 'https://mashroute.com/email-assets/mashroute-logo.png';
const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanHeader(value, fallback) {
  const cleaned = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return cleaned || fallback;
}

function cleanFilePart(value, fallback = 'Student') {
  const cleaned = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || fallback;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function passportOrStudentId(props) {
  return cleanHeader(props.passportNumber, props.studentId);
}

function buildSubject(props) {
  return `Notification: Offer Letter Issued — ${cleanHeader(props.studentName, 'Student')} | ${passportOrStudentId(props)}`;
}

function buildSalutation(props) {
  const name = cleanHeader(props.recipientName, 'Sir/Madam');
  if (props.recipientType !== 'STUDENT') return name;
  if (props.studentGender === 'MALE') return `Mr. ${name}`;
  if (props.studentGender === 'FEMALE') return `Ms. ${name}`;
  return name;
}

function offerLetterFilename(props) {
  const student = cleanFilePart(props.studentName);
  const identifier = cleanFilePart(passportOrStudentId(props), 'Student-ID');
  return `Offer-Letter-${student}-${identifier}.pdf`;
}

function normalizeProps(input) {
  const props = {
    ...input,
    recipientName: cleanHeader(input.recipientName, 'Sir/Madam'),
    studentName: cleanHeader(input.studentName, 'Student'),
    passportNumber: passportOrStudentId(input),
    programmeName: cleanHeader(input.programmeName, 'Not specified'),
    campusName: cleanHeader(input.campusName, 'Not specified'),
    senderName: cleanHeader(input.senderName, 'MashRoute'),
    senderDesignation: cleanHeader(input.senderDesignation, ''),
    tenantName: cleanHeader(input.tenantName, 'MashRoute'),
    logoUrl: /^https:\/\//i.test(String(input.logoUrl || '')) ? input.logoUrl : DEFAULT_LOGO_URL,
    attachmentFileName: cleanHeader(input.attachmentFileName, offerLetterFilename(input)),
    attachmentMimeType: cleanHeader(input.attachmentMimeType, 'application/pdf'),
  };
  return props;
}

function renderHtml(input) {
  const props = normalizeProps(input);
  const salutation = escapeHtml(buildSalutation(props));
  const size = formatFileSize(props.attachmentSize);
  const designation = props.senderDesignation
    ? `<div style="margin-top:3px;color:#475569;font-size:14px;">${escapeHtml(props.senderDesignation)}</div>`
    : '';
  const attachmentMeta = size ? `PDF &bull; ${escapeHtml(size)}` : 'PDF';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FB;color:#475569;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">The Offer Letter for ${escapeHtml(props.studentName)} has been issued and attached.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#F4F6FB;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #DDE3F2;border-radius:14px;overflow:hidden;">
<tr><td style="padding:20px 28px;background:#FFFFFF;"><img src="${escapeHtml(props.logoUrl)}" width="150" alt="MashRoute" style="display:block;width:150px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:28px;background:#5865E8;background-image:linear-gradient(135deg,#5865E8,#6D4AFF);color:#FFFFFF;">
<h1 style="margin:0;font-size:26px;line-height:1.25;color:#FFFFFF;">Offer Letter Issued</h1><p style="margin:7px 0 0;font-size:14px;color:#FFFFFF;">Official notification from MashRoute</p></td></tr>
<tr><td style="padding:30px 28px;">
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;"><strong style="color:#0F172A;">Dear ${salutation},</strong></p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;"><strong style="color:#0F172A;">Congratulations!</strong> We are pleased to inform you that the Offer Letter for the following student has been issued.</p>
<h2 style="margin:0 0 12px;font-size:17px;color:#0F172A;">Student Details</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#EEF0FF;border:1px solid #DDE3F2;border-radius:10px;">
${[['Student Name', `<strong>${escapeHtml(props.studentName)}</strong>`], ['Passport No.', `<strong>${escapeHtml(props.passportNumber)}</strong>`], ['Programme', escapeHtml(props.programmeName)], ['Campus', escapeHtml(props.campusName)]].map(([label, value]) => `<tr><td style="padding:11px 14px;color:#64748B;font-size:13px;border-bottom:1px solid #DDE3F2;">${label}</td><td style="padding:11px 14px;color:#0F172A;font-size:14px;text-align:right;border-bottom:1px solid #DDE3F2;">${value}</td></tr>`).join('')}
</table>
<div style="margin:22px 0;background:#EEF0FF;border-left:4px solid #6D4AFF;padding:15px 16px;color:#0F172A;font-size:15px;font-weight:600;line-height:1.55;">Please find the attached Offer Letter for your reference.</div>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">The official Offer Letter is also attached to this email.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #DDE3F2;border-radius:10px;"><tr><td width="52" style="padding:14px;color:#5865E8;font-size:24px;text-align:center;">&#128196;</td><td style="padding:14px 14px 14px 0;"><div style="color:#0F172A;font-size:14px;font-weight:700;">Attached Offer Letter</div><div style="margin-top:4px;color:#475569;font-size:13px;word-break:break-word;">${escapeHtml(props.attachmentFileName)}</div><div style="margin-top:3px;color:#64748B;font-size:12px;">${attachmentMeta}</div></td></tr></table>
<p style="margin:22px 0;font-size:15px;line-height:1.7;color:#475569;">If you have any questions or require further assistance, please contact the responsible agent or MashRoute support team.</p>
<div style="font-size:14px;line-height:1.55;color:#475569;">Kind regards,<div style="margin-top:8px;font-weight:700;color:#0F172A;">${escapeHtml(props.senderName)}</div>${designation}<div style="margin-top:3px;">MashRoute</div><div style="margin-top:3px;">${escapeHtml(props.tenantName)}</div></div>
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #DDE3F2;color:#64748B;font-size:11px;line-height:1.55;">This is an automated notification. Please do not share the Offer Letter or student information with unauthorized persons.</p>
</td></tr><tr><td style="padding:16px 28px;background:#F4F6FB;color:#64748B;font-size:11px;text-align:center;">MashRoute Student Application Management</td></tr></table>
</td></tr></table></body></html>`;
}

function renderText(input) {
  const props = normalizeProps(input);
  return [
    `Dear ${buildSalutation(props)},`, '',
    'Congratulations! We are pleased to inform you that the Offer Letter for the following student has been issued.', '',
    'Student Details', '',
    `Student Name: ${props.studentName}`,
    `Passport No.: ${props.passportNumber}`,
    `Programme: ${props.programmeName}`,
    `Campus: ${props.campusName}`, '',
    'Please find the attached Offer Letter for your reference.', '',
    'The official Offer Letter is also attached to this email.', '',
    'If you have any questions or require further assistance, please contact the responsible agent or MashRoute support team.', '',
    'Kind regards,', props.senderName,
    props.senderDesignation || null, 'MashRoute', props.tenantName, '',
    'This is an automated notification. Please do not share the Offer Letter or student information with unauthorized persons.',
  ].filter((line) => line !== null).join('\n');
}

function validateAttachment(document, file) {
  if (!document || document.type !== 'OFFER_LETTER' || document.status !== 'UPLOADED' || !document.isActive || document.deletedAt) {
    throw Object.assign(new Error('A completed Offer Letter document is required'), { code: 'INVALID_DOCUMENT', permanent: true });
  }
  if (document.mimeType !== 'application/pdf' || file?.mimetype !== 'application/pdf') {
    throw Object.assign(new Error('The Offer Letter must be a PDF'), { code: 'INVALID_MIME_TYPE', permanent: true });
  }
  const limit = Number(process.env.OFFER_LETTER_EMAIL_MAX_BYTES) || DEFAULT_MAX_ATTACHMENT_BYTES;
  if (!file?.buffer?.length) throw Object.assign(new Error('The Offer Letter file is missing'), { code: 'MISSING_FILE', permanent: true });
  if (file.buffer.length > limit) throw Object.assign(new Error('The Offer Letter exceeds the email attachment size limit'), { code: 'ATTACHMENT_TOO_LARGE', permanent: true });
  if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('The Offer Letter file content is not a valid PDF'), { code: 'INVALID_PDF', permanent: true });
  }
}

module.exports = {
  EVENT_TYPE, DEFAULT_LOGO_URL, buildSubject, buildSalutation, offerLetterFilename,
  normalizeProps, renderHtml, renderText, validateAttachment, escapeHtml, cleanHeader,
};
