// ============================================================
// twitter-client.js — Switchboard for X Data Sources
// ============================================================

const { TWITTERAPI_IO_KEY, X_BEARER_TOKEN } = require('./config');

/**
 * This module acts as a switchboard. 
 * Primary: TwitterAPI.io (Cost-Optimized Search)
 * Fallback: Official X API v2 (Higher Reliability/ToS Compliant)
 */

let activeClient;

if (TWITTERAPI_IO_KEY) {
  console.log("💎 Using TwitterAPI.io (Cost-Optimized Search)");
  activeClient = require('./clients/twitterapi-io');
} else if (X_BEARER_TOKEN) {
  console.log("🏢 Using Official X API v2 (Fallback)");
  activeClient = require('./clients/official-x-api');
} else {
  throw new Error("No Twitter data source configured. Set X_BEARER_TOKEN or TWITTERAPI_IO_KEY.");
}

module.exports = activeClient;
