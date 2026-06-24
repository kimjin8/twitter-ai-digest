// ============================================================
// render-sample.js — render the digest email HTML from a fixed sample
// ============================================================
//
// Used by run.sh to produce before/after email previews for the PR's
// Verification, so you can open both in a browser and see the change.
//
// It calls the REAL generator (src/digest-generator) against a fixed set of
// sample tweets, so the only thing that differs between "before" (origin/main)
// and "after" (the fix branch) is the code change — not the input.
//
// Trusted-runner only: this loads GEMINI_API_KEY from the main repo's .env and
// is invoked by run.sh AFTER the headless agent has exited — the agent never
// sees the key. Rendering uses Gemini Flash (≈ $0), not your Max plan.
//
// Usage: MAIN_REPO_DIR=/abs/path/to/repo node feedback-loop/render-sample.js <output.html>

const fs = require('fs');
const path = require('path');

const mainRepoDir = process.env.MAIN_REPO_DIR || path.join(__dirname, '..');
// Load the key BEFORE requiring config/digest-generator so config picks it up.
require('dotenv').config({ path: path.join(mainRepoDir, '.env') });

const out = process.argv[2];
if (!out) {
  console.error('usage: MAIN_REPO_DIR=<repo> node render-sample.js <output.html>');
  process.exit(1);
}

const { generateDigestHTML } = require('../src/digest-generator');
const sample = require('./sample-tweets.json');

(async () => {
  const { html, modelUsed } = await generateDigestHTML(sample);
  fs.writeFileSync(out, html);
  console.error(`rendered ${path.basename(out)} (${html.length} chars, model ${modelUsed})`);
})().catch(err => {
  console.error('render-sample failed:', err.message);
  process.exit(1);
});
