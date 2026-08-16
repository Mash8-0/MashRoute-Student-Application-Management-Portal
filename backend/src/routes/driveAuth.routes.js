/**
 * One-time Google Drive OAuth2 authorisation flow.
 *
 * Usage:
 *   1. Visit  GET /api/v1/drive-auth/url   → opens Google consent page
 *   2. Authorise → Google redirects to /api/v1/drive-auth/callback
 *   3. Copy the GOOGLE_REFRESH_TOKEN shown and paste it into .env / Hostinger env
 */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const { getOAuth2Client, getRedirectUrl } = require('../config/drive');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function saveRefreshTokenForLocalDev(refreshToken) {
  if (process.env.NODE_ENV === 'production') return false;

  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return false;

  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
    envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
  } else {
    envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
  return true;
}

router.get('/url', (req, res) => {
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`<h2>Auth denied: ${error}</h2>`);
  if (!code)  return res.status(400).send('<h2>Missing code parameter</h2>');

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return res.status(400).send(
        '<h2>No refresh token returned.</h2>' +
        '<p>Go back and try <a href="/api/v1/drive-auth/url">/api/v1/drive-auth/url</a> again.</p>'
      );
    }

    const savedLocally = saveRefreshTokenForLocalDev(refreshToken);
    const redirectUrl = getRedirectUrl();

    res.send(`
      <html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px">
        <h2 style="color:#22c55e">Google Drive authorised successfully!</h2>
        ${savedLocally
          ? '<p>The refresh token has been saved to your local <code>.env</code> file automatically.</p>'
          : '<p>Copy this token into your server environment as <code>GOOGLE_REFRESH_TOKEN</code>.</p>'
        }
        <p>Make sure <code>GOOGLE_REDIRECT_URI</code> is set to:</p>
        <pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtml(redirectUrl)}</pre>
        <p><strong>Restart the backend</strong> after updating the environment, then file uploads will go to Google Drive.</p>
        <hr>
        <p style="font-size:12px;color:#555">GOOGLE_REFRESH_TOKEN:</p>
        <pre style="white-space:pre-wrap;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtml(refreshToken)}</pre>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`<h2>Error exchanging code</h2><pre>${escapeHtml(err.message)}</pre>`);
  }
});

module.exports = router;
