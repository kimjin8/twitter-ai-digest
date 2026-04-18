// ============================================================
// twitterapi-io.js — TwitterAPI.io Client (Cost-Optimized Search)
// ============================================================

const axios = require('axios');
const { TWITTERAPI_IO_KEY, MIN_FAVES_FILTER } = require('../config');

const API_BASE = 'https://api.twitterapi.io/twitter';
const MAX_PAGES = 2;
const RATE_LIMIT_RETRY_DELAY = 5000; // 5s fallback if hitting QPS limit
const MAX_RETRIES = 2;

/**
 * TwitterAPI.io client for fetching tweets via Advanced Search.
 * Optimized Strategy: Source-level filtering + parallel requests + pagination.
 */
class TwitterapiIoClient {
  constructor() {
    this.apiKey = TWITTERAPI_IO_KEY;
  }

  /**
   * Standardize a raw TwitterAPI.io tweet into our internal format.
   */
  _standardizeTweet(t) {
    return {
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
      author_name: t.author?.name,
      author_username: t.author?.userName
    };
  }

  /**
   * Single API request with rate-limit retry fallback.
   */
  async _fetchPage(query, cursor = null) {
    const params = { query, query_type: 'Latest' };
    if (cursor) params.cursor = cursor;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const response = await axios.get(`${API_BASE}/tweet/advanced_search`, {
          params,
          headers: { 'X-API-Key': this.apiKey }
        });
        return response.data;
      } catch (err) {
        const status = err.response?.status;
        if ((status === 429 || (status >= 500 && status < 600)) && attempt <= MAX_RETRIES) {
          console.warn(`   ⚠ Rate limited (attempt ${attempt}), retrying in 5s...`);
          await new Promise(r => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Fetch tweets for a batch of users with pagination (up to MAX_PAGES).
   * Query: (from:user1 OR from:user2...) since:YYYY-MM-DD -is:retweet -is:reply min_faves:5
   */
  async getLatestTweetsForBatch(usernames, sinceDate) {
    if (!usernames || usernames.length === 0) return [];

    const fromClause = usernames.map(u => `from:${u}`).join(' OR ');
    const query = `(${fromClause}) since:${sinceDate} -is:retweet -is:reply min_faves:${MIN_FAVES_FILTER}`;

    const label = `batch[${usernames[0]}..+${usernames.length - 1}]`;

    try {
      let allTweets = [];
      let cursor = null;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await this._fetchPage(query, cursor);
        const tweets = data?.tweets || [];
        allTweets.push(...tweets.map(t => this._standardizeTweet(t)));

        if (!data?.has_next_page || !data?.next_cursor) break;
        cursor = data.next_cursor;
      }

      console.log(`   ✅ ${label}: ${allTweets.length} tweets (${Math.min(MAX_PAGES, 2)} pages)`);
      return allTweets;
    } catch (err) {
      console.error(`   ❌ ${label} failed:`, err.response?.data?.message || err.message);
      return [];
    }
  }
}

module.exports = new TwitterapiIoClient();
