const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

/**
 * Returns true only when all three Drive credentials are non-empty strings.
 */
function isDriveConfigured() {
  // Explicit opt-out: when USE_LOCAL_STORAGE=true, never attempt Drive.
  if (String(process.env.USE_LOCAL_STORAGE).toLowerCase() === 'true') return false;
  const folderId     = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const clientId     = (process.env.GOOGLE_CLIENT_ID       || '').trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN   || '').trim();
  // Reject obvious placeholder values
  const isReal = (v) => v && !v.startsWith('your_') && v.length > 10;
  return isReal(folderId) && isReal(clientId) && isReal(refreshToken);
}

function getDriveClient() {
  const clientId     = (process.env.GOOGLE_CLIENT_ID     || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must be set in .env.\n' +
      'Visit http://localhost:3001/api/v1/drive-auth/url to complete the one-time authorisation.'
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, getRedirectUrl());
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: oauth2 });
}

function getOAuth2Client() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUrl());
}

function getRedirectUrl() {
  const port = process.env.PORT || 3001;
  return `http://localhost:${port}/api/v1/drive-auth/callback`;
}

module.exports = { getDriveClient, getOAuth2Client, getRedirectUrl, isDriveConfigured };
