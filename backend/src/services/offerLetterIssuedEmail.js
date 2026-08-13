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
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@supports (-webkit-background-clip:text){.gradientText{background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important}.panelTitle{background-image:linear-gradient(90deg,#10D9F5,#8B2CF5);-webkit-background-clip:text;background-clip:text;color:transparent!important}}@media only screen and (max-width:640px){.shell{padding:3px!important}.card{width:100%!important;max-width:100%!important;border-radius:12px!important}.pad{padding-left:12px!important;padding-right:12px!important}.topPad{padding-top:13px!important}.contentPad{padding-bottom:16px!important}.hero{font-size:16px!important;letter-spacing:-.2px!important;line-height:1.18!important}.title{font-size:20px!important;line-height:1.14!important;margin-top:6px!important}.details{border-radius:12px!important}.label,.value{display:table-cell!important;text-align:left!important;vertical-align:top!important;padding-top:5px!important;padding-bottom:5px!important}.label{width:31%!important;font-size:10px!important;white-space:nowrap!important;padding-left:10px!important;padding-right:4px!important}.value{width:69%!important;font-size:11px!important;line-height:1.3!important;padding-left:4px!important;padding-right:10px!important}.art{width:108px!important;max-width:46%!important}.cta{width:150px!important;max-width:62%!important}.ctaLink{font-size:10px!important;line-height:16px!important;padding:11px 6px!important}.accent{width:32px!important}.salute{margin-bottom:5px!important;font-size:13px!important}.intro{font-size:12px!important;line-height:1.45!important;margin-bottom:13px!important}.supporting{font-size:11px!important;line-height:1.4!important;margin:12px 0!important}.panelHeading{padding:8px 10px 6px!important}.panelTitle{font-size:12px!important}.autoNotice{font-size:11px!important}.footerText{font-size:9px!important;line-height:1.35!important}}</style></head>
<body style="margin:0;padding:0;width:100%;overflow-x:hidden;background:#020B1D;color:#CBD5E1;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">The Offer Letter for ${escapeHtml(props.studentName)} has been issued. View it securely in MashRoute.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;background:#020B1D;"><tr><td class="shell" align="center" style="padding:12px 8px;">
<table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#06132A;border:2px solid #10D9F5;border-radius:20px;overflow:hidden;box-sizing:border-box;box-shadow:0 0 34px rgba(35,136,255,.24),0 0 18px rgba(139,44,245,.12);">
<tr><td class="pad topPad" style="padding:20px 20px 2px;text-align:center;"><p class="salute" style="margin:0 0 8px;text-align:left;font-size:15px;line-height:1.4;color:#CBD5E1;">Dear <strong style="color:#F8FAFC;">${salutation}</strong>,</p><img class="art" src="${escapeHtml(props.illustrationUrl)}" width="175" alt="Offer Letter Issued" style="display:block;margin:0 auto;width:175px;max-width:60%;height:auto;border:0;filter:drop-shadow(0 0 10px rgba(35,136,255,.28));"></td></tr>
<tr><td class="pad contentPad" style="padding:2px 20px 24px;text-align:center;">
<h1 class="hero" style="margin:0;color:#F8FAFC;font-size:24px;line-height:1.15;letter-spacing:0;text-transform:uppercase;white-space:nowrap;">CONGRATULATIONS!</h1>
<h2 class="title" style="margin:9px 0 10px;color:#10D9F5;font-size:29px;line-height:1.12;"><span class="gradientText" style="color:#10D9F5;">Offer Letter Issued</span></h2>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;"><tr><td class="accent" width="80" style="width:80px;border-top:1px solid #2388FF;font-size:1px;line-height:1px;">&nbsp;</td><td style="padding:0 12px;color:#10D9F5;font-size:16px;line-height:16px;">&#10022;</td><td class="accent" width="80" style="width:80px;border-top:1px solid #8B2CF5;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
<p class="intro" style="margin:0 0 20px;text-align:left;color:#F8FAFC;font-size:14px;line-height:1.55;">We are pleased to inform you that the Offer Letter has been issued as per the details below:</p>
<table class="details" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#08172E;border:1px solid #334561;border-radius:16px;box-shadow:inset 0 0 20px rgba(16,217,245,.03);">
<tr><td class="panelHeading" colspan="2" style="padding:15px 18px 10px;font-size:16px;font-weight:700;text-align:left;border-bottom:1px solid #334561;"><span style="display:inline-block;color:#10D9F5;border:1px solid #10D9F5;border-radius:50%;width:24px;height:24px;line-height:24px;text-align:center;">&#9675;</span>&nbsp;&nbsp;<span class="panelTitle" style="color:#10D9F5;">STUDENT DETAILS</span></td></tr>
${[['Student Name', `<strong>${escapeHtml(props.studentName)}</strong>`], ['Passport No.', `<strong>${escapeHtml(props.passportNumber)}</strong>`], ['Programme', escapeHtml(props.programmeName)], ['Campus', escapeHtml(props.campusName)]].map(([label, value]) => `<tr><td class="label" width="35%" style="padding:9px 18px;color:#CBD5E1;font-size:13px;text-align:left;vertical-align:top;">${label}&nbsp;&nbsp;:</td><td class="value" style="padding:9px 18px;color:#F8FAFC;font-size:14px;text-align:left;vertical-align:top;word-break:break-word;">${value}</td></tr>`).join('')}
</table>
<p class="supporting" style="margin:18px 0;color:#CBD5E1;font-size:13px;line-height:1.55;text-align:left;">${supporting}</p>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${secureUrl}" style="height:44px;v-text-anchor:middle;width:174px;" arcsize="20%" fillcolor="#2388FF" strokecolor="#2388FF"><w:anchorlock xmlns:w="urn:schemas-microsoft-com:office:word"/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">OPEN OFFER LETTER</center></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<table class="cta" role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;width:174px;max-width:72%;"><tr><td align="center" bgcolor="#2388FF" style="border-radius:10px;background:#2388FF;background-image:linear-gradient(90deg,#10D9F5 0%,#2388FF 48%,#8B2CF5 100%);box-shadow:0 0 18px rgba(35,136,255,.25);"><a class="ctaLink" href="${secureUrl}" target="_blank" style="display:block;padding:13px 6px;color:#FFFFFF;font-size:14px;font-weight:700;line-height:18px;text-decoration:none;white-space:nowrap;">OPEN OFFER LETTER</a></td></tr></table>
<!--<![endif]-->
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;"><tr><td style="border-top:1px solid #2388FF;line-height:1px;">&nbsp;</td><td width="32" style="color:#10D9F5;font-size:16px;">&#10022;</td><td style="border-top:1px solid #8B2CF5;line-height:1px;">&nbsp;</td></tr></table>
<p class="autoNotice" style="margin:13px 0 0;color:#CBD5E1;font-size:13px;line-height:1.5;">This is an automated email. No reply is required.</p>
<p class="footerText" style="margin:18px 0 4px;color:#CBD5E1;font-size:12px;">MashRoute | Student Application Management Portal</p><p class="footerText" style="margin:0;color:#94A3B8;font-size:12px;">Simplifying Every Step of the Student Journey</p>
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
