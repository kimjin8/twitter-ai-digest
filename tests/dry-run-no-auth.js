// ============================================================
// dry-run-no-auth.js — Test Twitter + AI without Gmail
// ============================================================

require("dotenv").config();
const twitterClient = require("../src/twitter-client");
const { parseTweets } = require("../src/tweet-parser");
const { scoreTweets } = require("../src/tweet-scorer");
const { generateDigestHTML } = require("../src/digest-generator");

const TWITTER_USERNASES_TEST = ['lexfridman', 'sama'];

async function test() {
  console.log("🚀 Running dry-run (Twitter + AI only)...");
  
  for (const username of TWITTER_USERNASES_TEST) {
    console.log(`📡 Fetching @${username}...`);
    const userId = await twitterClient.getUserId(username);
    if (!userId) {
      console.log(`   ❌ Could not find user ID for @${username}`);
      continue;
    }
    
    const rawTweets = await twitterClient.getUserTweets(userId);
    const parsed = parseTweets(rawTweets, username);
    console.log(`   ✅ Found ${parsed.length} tweets from last 24h.`);
    
    if (parsed.length > 0) {
      const scored = scoreTweets(parsed);
      const top = scored.slice(0, 5);
      const html = await generateDigestHTML(top);
      console.log(`\n--- GENERATED HTML PREVIEW (${html.length} chars) ---\n`);
      console.log(html.substring(0, 500) + "...");
    }
  }
}

test().catch(console.error);
