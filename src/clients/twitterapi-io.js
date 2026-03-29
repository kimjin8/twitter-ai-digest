// ============================================================
// twitterapi-io.js — TwitterAPI.io Client (Cost-Optimized Search)
// ============================================================

const axios = require('axios');
const { TWITTERAPI_IO_KEY, MIN_FAVES_FILTER } = require('../config');

const API_BASE = 'https://api.twitterapi.io/twitter';

/**
 * TwitterAPI.io client for fetching tweets via Advanced Search.
 * Optimized Strategy: Source-level filtering to save credits.
 */
class TwitterapiIoClient {
  constructor() {
    this.apiKey = TWITTERAPI_IO_KEY;
  }

  /**
   * Fetch latest tweets for a batch of users using Advanced Search.
   * Query: (from:user1 OR from:user2...) since:YYYY-MM-DD -is:retweet -is:reply min_faves:5
   */
  async getLatestTweetsForBatch(usernames, sinceDate) {
    if (!usernames || usernames.length === 0) return [];

    // Build query with cost-saving filters
    const fromClause = usernames.map(u => `from:${u}`).join(' OR ');
    
    // Move filters to the query level to reduce the number of tweets we pay for
    const query = `(${fromClause}) since:${sinceDate} -is:retweet -is:reply min_faves:${MIN_FAVES_FILTER}`;

    console.log(`🔍 Batch searching (Optimized): ${usernames.length} users...`);
    
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
      console.log(`   ✅ Found ${tweets.length} high-signal tweets for this batch.`);
      
      // Standardize the format
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
        author_username: t.author?.userName 
      }));
    } catch (err) {
      console.error(`❌ Batch search failed:`, err.response?.data?.message || err.message);
      return [];
    }
  }
}

module.exports = new TwitterapiIoClient();
