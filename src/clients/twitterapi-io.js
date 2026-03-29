// ============================================================
// twitterapi-io.js — TwitterAPI.io Client (Cost-Optimized Search)
// ============================================================

const axios = require('axios');
const { TWITTERAPI_IO_KEY } = require('../config');

const API_BASE = 'https://api.twitterapi.io/twitter';

/**
 * TwitterAPI.io client for fetching tweets via Advanced Search.
 * This is the cost-optimized strategy ($0.15 / 1k tweets).
 */
class TwitterapiIoClient {
  constructor() {
    this.apiKey = TWITTERAPI_IO_KEY;
  }

  /**
   * Fetch latest tweets for a batch of users using Advanced Search.
   * Query: (from:user1 OR from:user2...) since:YYYY-MM-DD
   */
  async getLatestTweetsForBatch(usernames, sinceDate) {
    if (!usernames || usernames.length === 0) return [];

    // Build query: (from:user1 OR from:user2) since:2026-03-24
    const fromClause = usernames.map(u => `from:${u}`).join(' OR ');
    const query = `(${fromClause}) since:${sinceDate}`;

    console.log(`🔍 Batch searching: ${usernames.join(', ')}...`);
    
    try {
      const response = await axios.get(`${API_BASE}/tweet/advanced_search`, {
        params: {
          query: query,
          query_type: 'Latest'
        },
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      const tweets = response.data?.tweets || [];
      console.log(`   ✅ Found ${tweets.length} tweets for this batch.`);
      
      // Standardize the format to match the official API fields needed by parser
      // official-x-api fields: id, text, created_at, public_metrics, entities, author_id
      return tweets.map(t => ({
        id: t.id,
        text: t.text,
        created_at: t.createdAt,
        public_metrics: {
          retweet_count: t.retweetCount || 0,
          reply_count: t.replyCount || 0,
          like_count: t.likeCount || 0,
          quote_count: t.quoteCount || 0
        },
        entities: t.entities || {},
        author_id: t.author?.id,
        // Helper field for the parser to know which user this belongs to
        author_username: t.author?.userName 
      }));
    } catch (err) {
      console.error(`❌ Batch search failed:`, err.response?.data?.message || err.message);
      return [];
    }
  }
}

module.exports = new TwitterapiIoClient();
