// ============================================================
// config.js — Centralized Configuration
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ── X (Twitter) Data Sources ────────────────────────────────
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const TWITTERAPI_IO_KEY = process.env.TWITTERAPI_IO_KEY;

// ── Gemini AI ───────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite-preview';
const STABLE_FALLBACK_MODEL = 'gemini-2.5-flash';

// ── Email ───────────────────────────────────────────────────
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || 'hongkimjin@gmail.com';

// ── Location/Time ──────────────────────────────────────────
const TIMEZONE = process.env.TIMEZONE || 'America/Los_Angeles';

// ── Twitter Usernames ───────────────────────────────────────
const rawUsernames = process.env.TWITTER_USERNAMES || 'lexfridman,sama,kaifulee';
const TWITTER_USERNAMES = rawUsernames.split(',').map(u => u.trim()).filter(u => u.length > 0);

// ── Paths ───────────────────────────────────────────────────
const GOOGLE_CREDENTIALS_PATH = path.join(__dirname, '..', 'google-credentials.json');
const GOOGLE_TOKEN_PATH = path.join(__dirname, '..', 'google-token.json');
const USER_ID_CACHE_PATH = path.join(__dirname, '..', 'data', 'user-id-cache.json');

// ── Google OAuth Scopes ─────────────────────────────────────
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send'
];

// ── Validation ──────────────────────────────────────────────
function validateConfig() {
  const missing = [];
  
  // Need at least one source
  if (!X_BEARER_TOKEN && !TWITTERAPI_IO_KEY) {
    missing.push('X_BEARER_TOKEN or TWITTERAPI_IO_KEY');
  }
  
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY');

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    missing.forEach(v => console.error(`   • ${v}`));
    console.error('\n   Check your .env file.\n');
    process.exit(1);
  }
}

module.exports = {
  X_BEARER_TOKEN,
  TWITTERAPI_IO_KEY,
  GEMINI_API_KEY,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  STABLE_FALLBACK_MODEL,
  RECIPIENT_EMAIL,
  TWITTER_USERNAMES,
  GOOGLE_CREDENTIALS_PATH,
  GOOGLE_TOKEN_PATH,
  USER_ID_CACHE_PATH,
  GOOGLE_SCOPES,
  TIMEZONE,
  validateConfig
};
