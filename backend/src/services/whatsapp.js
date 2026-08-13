/**
 * Meta WhatsApp Cloud API client.
 *
 * Sends ONLY pre-approved template messages (never free-text), so messages are
 * delivered outside the 24-hour customer-service window safely.
 *
 *   POST https://graph.facebook.com/{version}/{phone-number-id}/messages
 *
 * Credentials live in the backend environment (never exposed to the client):
 *   WHATSAPP_API_VERSION, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
 *   WHATSAPP_LANG, WHATSAPP_DEFAULT_COUNTRY_CODE
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const DEFAULT_LANG = process.env.WHATSAPP_LANG || 'en_US';
const DEFAULT_CC = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '').replace(/\D/g, '');

/** Whether the server has the Meta credentials needed to send. */
function isConfigured() {
  return Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
}

/**
 * Normalize a phone number to WhatsApp's expected format: digits only, with a
 * country code. Local numbers (leading 0) get the default country code.
 * Returns null when there's nothing usable.
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const hadPlus = String(raw).trim().startsWith('+');
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (hadPlus) return digits;                 // +60… already international
  if (digits.startsWith('00')) return digits.slice(2) || null; // 0060… international prefix
  if (digits.startsWith('0')) {               // local number with trunk 0
    const local = digits.replace(/^0+/, '');
    return DEFAULT_CC ? DEFAULT_CC + local : local;
  }
  // No leading 0: prepend the default country code unless it already has one.
  if (DEFAULT_CC && !digits.startsWith(DEFAULT_CC) && digits.length <= 10) return DEFAULT_CC + digits;
  return digits;
}

/**
 * Send an approved WhatsApp template message.
 *
 * @param {string} to            recipient phone (any format; normalized here)
 * @param {string} templateName  approved template name
 * @param {Array<string|number>} variables  body {{1}}, {{2}}… parameters, in order
 * @param {object} [opts]        { lang }
 * @returns {Promise<{ ok:boolean, status:number, to:string, response:any }>}
 * @throws  when not configured or the recipient number is invalid
 */
async function sendWhatsAppTemplate(to, templateName, variables = [], opts = {}) {
  if (!isConfigured()) {
    throw new Error('WhatsApp is not configured (missing WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
  }
  const phone = normalizePhone(to);
  if (!phone) throw new Error(`Invalid recipient phone: ${to}`);

  const components = [];
  const params = (variables || []).filter((v) => v !== undefined && v !== null).map((v) => ({ type: 'text', text: String(v) }));
  if (params.length) components.push({ type: 'body', parameters: params });

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: opts.lang || DEFAULT_LANG },
      ...(components.length && { components }),
    },
  };

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let json;
  try { json = await res.json(); } catch { json = { raw: await res.text().catch(() => '') }; }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `WhatsApp API error (HTTP ${res.status})`);
    err.status = res.status;
    err.response = json;
    throw err;
  }
  return { ok: true, status: res.status, to: phone, response: json };
}

module.exports = { sendWhatsAppTemplate, isConfigured, normalizePhone };
