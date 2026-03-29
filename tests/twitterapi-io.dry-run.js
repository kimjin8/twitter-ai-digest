// ============================================================
// tests/twitterapi-io.dry-run.js
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const twitterapiIo = require('../src/clients/twitterapi-io');
const { TWITTER_USERNAMES } = require('../src/config');

/**
 * Quick dry-run test for TwitterAPI.io Advanced Search batching.
 */
async function testBatchSearch() {
  console.log("🚀 Testing TwitterAPI.io Batch Search...");
  
  if (!process.env.TWITTERAPI_IO_KEY) {
    console.error("❌ TWITTERAPI_IO_KEY not found in .env");
    process.exit(1);
  }

  const last24h = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const testBatch = TWITTER_USERNAMES.slice(0, 10); // Test first 10 users
  
  console.log(`📡 Fetching tweets for: ${testBatch.join(', ')} (Since ${last24h})`);
  
  try {
    const tweets = await twitterapiIo.getLatestTweetsForBatch(testBatch, last24h);
    
    if (tweets.length === 0) {
      console.log("📭 No tweets found for this batch in the last 24h.");
    } else {
      console.log(`✅ Success! Found ${tweets.length} tweets.`);
      tweets.slice(0, 3).forEach(t => {
        console.log(`   - [@${t.author_username}] ${t.text.substring(0, 60)}...`);
      });
    }
  } catch (err) {
    console.error("💥 Test failed:", err.message);
  }
}

testBatchSearch();
