const path = require('path');

const EVENT_TYPE = 'OFFER_LETTER_ISSUED';
const DEFAULT_LOGO_URL = 'https://mashroute.com/email-assets/mashroute-logo.png';
const DEFAULT_ILLUSTRATION_URL = 'https://mashroute.com/email-assets/offer-letter-issued.png';
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
    illustrationUrl: /^https:\/\//i.test(String(input.illustrationUrl || '')) || process.env.NODE_ENV !== 'production' ? String(input.illustrationUrl || DEFAULT_ILLUSTRATION_URL) : DEFAULT_ILLUSTRATION_URL,
    secureUrl: /^https:\/\//i.test(String(input.secureUrl || '')) || process.env.NODE_ENV !== 'production' ? String(input.secureUrl || '') : '',
    attachmentIncluded: input.attachmentIncluded !== false,
    attachmentFileName: cleanHeader(input.attachmentFileName, offerLetterFilename(input)),
    attachmentMimeType: cleanHeader(input.attachmentMimeType, 'application/pdf'),
  };
  return props;
}

function renderHtml(input) {
  const props = normalizeProps(input);
  const salutation = escapeHtml(buildSalutation(props));
  const supporting = props.attachmentIncluded
    ? 'Please find the attached Offer Letter for your reference. You may also view it securely using the button below.'
    : 'Please view your Offer Letter securely using the button below.';
  const secureUrl = escapeHtml(props.secureUrl);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@supports (-webkit-background-clip:text){.gradientText{background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important}}@media only screen and (max-width:640px){.shell{padding:12px 0!important}.card{width:calc(100% - 16px)!important;max-width:calc(100% - 16px)!important;border-radius:16px!important}.pad{padding-left:20px!important;padding-right:20px!important}.hero{font-size:31px!important}.title{font-size:34px!important}.label,.value{display:block!important;width:auto!important;text-align:left!important}.value{padding-top:2px!important}.art{width:230px!important}.cta{width:100%!important}}</style></head>
<body style="margin:0;padding:0;background:#020B1D;color:#CBD5E1;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">The Offer Letter for ${escapeHtml(props.studentName)} has been issued. View it securely in MashRoute.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#020B1D;"><tr><td class="shell" align="center" style="padding:28px 12px;">
<table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#06132A;border:1px solid #2388FF;border-radius:26px;overflow:hidden;box-shadow:0 0 30px rgba(35,136,255,.18);">
<tr><td class="pad" style="padding:32px 38px 16px;text-align:center;"><p style="margin:0 0 18px;text-align:left;font-size:15px;line-height:1.6;color:#CBD5E1;">Dear <strong style="color:#F8FAFC;">${salutation}</strong>,</p><img class="art" src="${escapeHtml(props.illustrationUrl)}" width="280" alt="Offer Letter Issued" style="display:block;margin:0 auto;width:280px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="pad" style="padding:4px 38px 30px;text-align:center;">
<h1 class="hero" style="margin:0;color:#F8FAFC;font-size:39px;line-height:1.15;letter-spacing:1px;text-transform:uppercase;">CONGRATULATIONS!</h1>
<h2 class="title" style="margin:12px 0 24px;color:#10D9F5;font-size:42px;line-height:1.12;"><span class="gradientText" style="color:#10D9F5;">Offer Letter Issued</span></h2>
<p style="margin:0 0 24px;text-align:left;color:#CBD5E1;font-size:16px;line-height:1.65;">We are pleased to inform you that the Offer Letter has been issued as per the details below:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#08172E;border:1px solid #334561;border-radius:16px;">
<tr><td colspan="2" style="padding:20px 20px 12px;color:#10D9F5;font-size:17px;font-weight:700;text-align:left;border-bottom:1px solid #334561;">&#9675;&nbsp; STUDENT DETAILS</td></tr>
${[['Student Name', `<strong>${escapeHtml(props.studentName)}</strong>`], ['Passport No.', `<strong>${escapeHtml(props.passportNumber)}</strong>`], ['Programme', escapeHtml(props.programmeName)], ['Campus', escapeHtml(props.campusName)]].map(([label, value]) => `<tr><td class="label" width="34%" style="padding:11px 20px;color:#94A3B8;font-size:14px;text-align:left;vertical-align:top;">${label}</td><td class="value" style="padding:11px 20px;color:#F8FAFC;font-size:15px;text-align:left;vertical-align:top;word-break:break-word;">${value}</td></tr>`).join('')}
</table>
<p style="margin:22px 0;color:#CBD5E1;font-size:14px;line-height:1.65;text-align:left;">${supporting}</p>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${secureUrl}" style="height:52px;v-text-anchor:middle;width:360px;" arcsize="20%" fillcolor="#2388FF" strokecolor="#2388FF"><w:anchorlock xmlns:w="urn:schemas-microsoft-com:office:word"/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">OPEN OFFER LETTER</center></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<table class="cta" role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;width:360px;max-width:100%;"><tr><td align="center" bgcolor="#2388FF" style="border-radius:12px;background:#2388FF;background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);"><a href="${secureUrl}" target="_blank" style="display:block;padding:16px 22px;color:#FFFFFF;font-size:17px;font-weight:700;line-height:20px;text-decoration:none;">&#9993;&nbsp;&nbsp; OPEN OFFER LETTER</a></td></tr></table>
<!--<![endif]-->
<p style="margin:28px 0 0;padding-top:22px;border-top:1px solid #334561;color:#94A3B8;font-size:14px;line-height:1.6;">This is an automated email. No reply is required.</p>
<p style="margin:22px 0 3px;color:#CBD5E1;font-size:13px;">MashRoute | Student Application Management Portal</p><p style="margin:0;color:#94A3B8;font-size:13px;">Simplifying Every Step of the Student Journey</p>
</td></tr></table>
</td></tr></table></body></html>`;
}

function renderText(input) {
  const props = normalizeProps(input);
  return [
    `Dear ${buildSalutation(props)},`, '',
    'CONGRATULATIONS!', '', 'Offer Letter Issued', '',
    'We are pleased to inform you that the Offer Letter has been issued as per the details below:', '',
    'STUDENT DETAILS', '',
    `Student Name: ${props.studentName}`,
    `Passport No.: ${props.passportNumber}`,
    `Programme: ${props.programmeName}`,
    `Campus: ${props.campusName}`, '',
    props.attachmentIncluded ? 'Please find the attached Offer Letter for your reference. You may also view it securely using the button below.' : 'Please view your Offer Letter securely using the button below.', '',
    'OPEN OFFER LETTER', props.secureUrl, '',
    'This is an automated email. No reply is required.', '',
    'MashRoute | Student Application Management Portal',
    'Simplifying Every Step of the Student Journey',
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
  if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('The Offer Letter file content is not a valid PDF'), { code: 'INVALID_PDF', permanent: true });
  }
  return { attachmentIncluded: file.buffer.length <= limit, limit };
}

module.exports = {
  EVENT_TYPE, DEFAULT_LOGO_URL, DEFAULT_ILLUSTRATION_URL, buildSubject, buildSalutation, offerLetterFilename,
  normalizeProps, renderHtml, renderText, validateAttachment, escapeHtml, cleanHeader,
};
