// ============================================================
// auth.js — Google OAuth2 Authentication
// ============================================================

const { google } = require('googleapis');
const fs = require('fs');
const http = require('http');
const url = require('url');
const {
  GOOGLE_CREDENTIALS_PATH,
  GOOGLE_TOKEN_PATH,
  GOOGLE_SCOPES,
} = require('./config');

const OAUTH_CALLBACK_PORT = 3099;

/**
 * Get the credentials object from file or environment variable.
 */
function getCredentialsSync() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  if (fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(GOOGLE_CREDENTIALS_PATH, 'utf8'));
  }
  throw new Error('Google credentials not found (set GOOGLE_CREDENTIALS_JSON or provide google-credentials.json).');
}

/**
 * Get the token object from file or environment variable.
 */
function getTokenSync() {
  if (process.env.GOOGLE_TOKEN_JSON) {
    return JSON.parse(process.env.GOOGLE_TOKEN_JSON);
  }
  if (fs.existsSync(GOOGLE_TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(GOOGLE_TOKEN_PATH, 'utf8'));
  }
  return null;
}

/**
 * Save the token to local file (used during local auth).
 */
function saveTokenSync(token) {
  fs.writeFileSync(GOOGLE_TOKEN_PATH, JSON.stringify(token, null, 2));
}

/**
 * Get an authenticated Google API client.
 */
async function getGoogleAuthClient() {
  const credentials = getCredentialsSync();
  const clientConfig = credentials.web || credentials.installed;
  if (!clientConfig) throw new Error("Malformed google credentials: expected 'web' or 'installed' property.");

  const { client_id, client_secret } = clientConfig;
  const redirectUri = `http://localhost:3099/oauth2callback`;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const token = getTokenSync();
  if (!token) {
    throw new Error('No Google token found. Run: node index.js --auth');
  }
  oAuth2Client.setCredentials(token);

  // Auto-refresh if expired
  if (token.expiry_date && token.expiry_date < Date.now()) {
    console.log('🔄 Google token expired, refreshing...');
    try {
      const { credentials: newToken } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(newToken);
      // Only write back to file if we're not using env var for token
      if (!process.env.GOOGLE_TOKEN_JSON) {
        saveTokenSync(newToken);
      }
      console.log('✅ Token refreshed successfully');
    } catch (err) {
      throw new Error(`Failed to refresh Google token: ${err.message}. Re-run: node index.js --auth`);
    }
  }

  return oAuth2Client;
}

/**
 * Run the interactive Google OAuth flow.
 */
async function authenticateGoogle() {
  const credentials = getCredentialsSync();
  const clientConfig = credentials.web || credentials.installed;
  const { client_id, client_secret } = clientConfig;
  const redirectUri = `http://localhost:3099/oauth2callback`;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
  });

  console.log('\n🔐 Open this URL in your browser to authorize:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const queryParams = url.parse(req.url, true).query;

      if (queryParams.code) {
        try {
          const { tokens } = await oAuth2Client.getToken(queryParams.code);
          oAuth2Client.setCredentials(tokens);
          saveTokenSync(tokens);
          res.end('✅ Authorization successful! You can close this window.');
          console.log('✅ Google token saved to', GOOGLE_TOKEN_PATH);
          server.close();
          resolve(oAuth2Client);
        } catch (err) {
          res.end('❌ Authorization failed.');
          server.close();
          reject(err);
        }
      }
    });

    server.listen(OAUTH_CALLBACK_PORT);
  });
}

module.exports = { getGoogleAuthClient, authenticateGoogle };
