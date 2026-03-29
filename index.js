// ============================================================
// Daily Twitter AI Digest — Main Entry Point
// ============================================================

console.log("--- CONTAINER STARTING ---");
require("dotenv").config();

const { 
  validateConfig, 
  TWITTER_USERNAMES, 
  RECIPIENT_EMAIL 
} = require("./src/config");

const { getGoogleAuthClient, authenticateGoogle } = require("./src/auth");
const twitterClient = require("./src/twitter-client");
const { parseTweets } = require("./src/tweet-parser");
const { scoreTweets } = require("./src/tweet-scorer");
const { generateDigestHTML } = require("./src/digest-generator");
const { sendEmail } = require("./src/email");

const MAX_TWEETS_FOR_AI = 30;

/**
 * Run the complete Twitter AI digest pipeline.
 */
async function runWorkflow({ dryRun = false } = {}) {
  console.log("\n========================================");
  console.log("🚀 Daily Twitter AI Digest");
  console.log(`   ${new Date().toLocaleString()} (Local Time)`);
  console.log("========================================\n");

  // 1. Validate environment
  validateConfig();

  // 2. Google Auth (for Gmail)
  let authClient = null;
  try {
    authClient = await getGoogleAuthClient();
  } catch (err) {
    if (!dryRun) throw err;
    console.warn("⚠ Continuing without Google auth (dry-run mode)");
  }

  // 3. Fetch & Parse Tweets
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`📡 Monitoring ${TWITTER_USERNAMES.length} profiles (since ${last24h})...`);
  let allParsedTweets = [];

  // Check if current client supports batched search (TwitterAPI.io)
  if (twitterClient.getLatestTweetsForBatch) {
    const batchSize = 10;
    for (let i = 0; i < TWITTER_USERNAMES.length; i += batchSize) {
      const batch = TWITTER_USERNAMES.slice(i, i + batchSize);
      try {
        const rawTweets = await twitterClient.getLatestTweetsForBatch(batch, last24h);
        const parsed = parseTweets(rawTweets); 
        allParsedTweets.push(...parsed);
        
        // Respect rate limits (Free tier: 1 req / 5s)
        if (i + batchSize < TWITTER_USERNAMES.length) {
          console.log(`   ⏳ Sleeping 5s to respect rate limits...`);
          await new Promise(resolve => setTimeout(resolve, 5100));
        }
      } catch (err) {
        console.error(`   ❌ Failed to process batch ${i/batchSize + 1}:`, err.message);
      }
    }
  } else {
    // Fallback: Parallel fetch one by one (Official X API)
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(10);

    const tasks = TWITTER_USERNAMES.map(username => limit(async () => {
      try {
        const userId = await twitterClient.getUserId(username);
        if (!userId) return;
        
        const rawTweets = await twitterClient.getUserTweets(userId);
        const parsed = parseTweets(rawTweets, username);
        allParsedTweets.push(...parsed);
      } catch (err) {
        console.error(`   ❌ Failed to process @${username}:`, err.message);
      }
    }));
    await Promise.all(tasks);
  }

  if (allParsedTweets.length === 0) {
    console.log("📭 No high-signal tweets found in the last 24 hours. Aborting.");
    return;
  }

  console.log(`📊 Found ${allParsedTweets.length} original tweets. Scoring...`);

  // 4. Score & Rank
  const scoredTweets = scoreTweets(allParsedTweets);
  const topTweets = scoredTweets.slice(0, MAX_TWEETS_FOR_AI);

  console.log(`🎯 Selected top ${topTweets.length} tweets for AI synthesis.`);

  // 5. Generate AI Digest
  const htmlEmail = await generateDigestHTML(topTweets);

  // 6. Send Email
  if (dryRun) {
    console.log("\n========================================");
    console.log("🏜️  DRY RUN — Email not sent");
    console.log("========================================\n");
    console.log("Use a browser to preview the HTML if needed.");
  } else {
    if (!authClient) throw new Error("Cannot send email without Google auth.");
    await sendEmail(authClient, htmlEmail);
  }

  console.log("\n========================================");
  console.log("✅ Workflow complete!");
  console.log("========================================\n");
}

// CLI Logic
(async () => {
  const args = process.argv.slice(2);

  if (args.includes("--auth")) {
    await authenticateGoogle();
    process.exit(0);
  }

  if (args.includes("--dry-run")) {
    await runWorkflow({ dryRun: true });
    process.exit(0);
  }

  await runWorkflow();
  process.exit(0);
})().catch(err => {
  console.error("\n💥 Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
