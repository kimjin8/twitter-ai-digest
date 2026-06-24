// ============================================================
// render-sample.js — render the digest email HTML from a fixed sample
// ============================================================
//
// Used by the email-autofix engine (the runner's before/after preview) AND by
// the headless agent to verify a fix against the REAL output. Calls the real
// generator (src/digest-generator) against fixed sample tweets, so only the
// code change differs between renders — not the input.
//
// Output path: argv[2], else $OUT, else a temp file. The final path is printed
// to stdout so the caller can read it.
// GEMINI_API_KEY: from the project's .env when present, else the shared engine's
// ~/.email-autofix/auth/.env — so it works headless under cron and for the
// agent (which never needs the key in its own env). Gemini Flash, ≈ $0.
//
// Usage:  node email-autofix/render-sample.js [output.html]

const fs = require('fs');
const os = require('os');
const path = require('path');

const mainRepoDir = process.env.MAIN_REPO_DIR || path.join(__dirname, '..');
// Load the key BEFORE requiring config/digest-generator (dotenv won't override
// an already-set var, so the project's .env wins when reachable).
require('dotenv').config({ path: path.join(mainRepoDir, '.env') });
require('dotenv').config({ path: path.join(os.homedir(), '.email-autofix', 'auth', '.env') });

const out = process.argv[2] || process.env.OUT || path.join(os.tmpdir(), `eaf-render-${Date.now()}.html`);

const { generateDigestHTML } = require('../src/digest-generator');
const sample = require('./sample-tweets.json');

(async () => {
  const { html, modelUsed } = await generateDigestHTML(sample);
  fs.writeFileSync(out, html);
  console.error(`rendered ${html.length} chars (model ${modelUsed})`);
  console.log(out); // path on stdout for the caller (runner or agent) to read
})().catch(err => {
  console.error('render-sample failed:', err.message);
  process.exit(1);
});
