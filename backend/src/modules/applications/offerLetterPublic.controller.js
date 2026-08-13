const asyncHandler = require('../../utils/asyncHandler');
const access = require('../../services/offerLetterAccess');

function securityHeaders(res) {
  res.set({
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  });
}

function safePage(title, message, fileUrl) {
  const viewer = fileUrl ? `<iframe title="Offer Letter PDF" src="${fileUrl}" style="width:100%;height:75vh;border:1px solid #334561;border-radius:12px;background:#fff"></iframe>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#020b1d;color:#f8fafc;font-family:Arial,Helvetica,sans-serif"><main style="max-width:960px;margin:auto;padding:24px"><div style="border:1px solid #2388ff;border-radius:16px;background:#06132a;padding:24px"><div style="color:#10d9f5;font-weight:700">MashRoute</div><h1>Offer Letter</h1><p style="color:#cbd5e1">${message}</p>${viewer}</div></main></body></html>`;
}

const view = asyncHandler(async (req, res) => {
  securityHeaders(res);
  const result = await access.validateAccess(req.params.token);
  await access.auditAccess(result, req);
  if (!result.allowed) return res.status(result.reason === 'EXPIRED_TOKEN' ? 410 : 403).send(safePage('Offer Letter Access', 'This secure link is invalid, expired, or no longer available.'));
  const filePath = `/api/v1/offer-letter/file/${encodeURIComponent(req.params.token)}${result.record.allowDownload ? '' : '#toolbar=0&navpanes=0'}`;
  return res.send(safePage('Offer Letter', 'Your secure Offer Letter is shown below. This link is private and time-limited.', filePath));
});

const file = asyncHandler(async (req, res) => {
  securityHeaders(res);
  const result = await access.validateAccess(req.params.token);
  await access.auditAccess(result, req);
  if (!result.allowed) return res.status(403).send('Offer Letter access denied');
  const buffer = await access.readDocument(result.document);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `${result.record.allowDownload ? 'inline' : 'inline'}; filename="Offer-Letter.pdf"`);
  return res.send(buffer);
});

module.exports = { view, file, securityHeaders };
