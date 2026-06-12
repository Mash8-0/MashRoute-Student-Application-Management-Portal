/**
 * One-time Google Drive OAuth2 authorisation flow.
 *
 * Usage:
 *   1. Visit  GET /api/v1/drive-auth/url   → opens Google consent page
 *   2. Authorise → Google redirects to /api/v1/drive-auth/callback
 *   3. Copy the GOOGLE_REFRESH_TOKEN shown and paste it into .env
 */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const { getOAuth2Client } = require('../config/drive');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

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

    // Auto-write to .env
    const envPath = path.join(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
    } else {
      envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;

    res.send(`
      <html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px">
        <h2 style="color:#22c55e">✅ Google Drive authorised successfully!</h2>
        <p>The refresh token has been saved to your <code>.env</code> file automatically.</p>
        <p><strong>Restart the backend</strong> to apply the change, then all file uploads will go to Google Drive.</p>
        <hr>
        <p style="font-size:12px;color:#888">Refresh token (already saved): <code>${refreshToken}</code></p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`<h2>Error exchanging code</h2><pre>${err.message}</pre>`);
  }
});

module.exports = router;
