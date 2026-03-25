// ============================================================
// twitter-client.js — X API v2 Client
// ============================================================

const axios = require('axios');
const fs = require('fs');
const { X_BEARER_TOKEN, USER_ID_CACHE_PATH } = require('./config');

const API_BASE = 'https://api.twitter.com/2';

/**
 * X API v2 client for fetching tweets.
 */
class TwitterClient {
  constructor() {
    this.token = X_BEARER_TOKEN;
    this.cache = this.loadCache();
  }

  loadCache() {
    if (fs.existsSync(USER_ID_CACHE_PATH)) {
      try {
        return JSON.parse(fs.readFileSync(USER_ID_CACHE_PATH, 'utf8'));
      } catch (err) {
        return {};
      }
    }
    return {};
  }

  saveCache() {
    const dir = require('path').dirname(USER_ID_CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_ID_CACHE_PATH, JSON.stringify(this.cache, null, 2));
  }

  async getUserId(username) {
    if (this.cache[username]) return this.cache[username];

    console.log(`🔍 Looking up ID for @${username}...`);
    try {
      const res = await axios.get(`${API_BASE}/users/by/username/${username}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (res.data?.data?.id) {
        const id = res.data.data.id;
        this.cache[username] = id;
        this.saveCache();
        return id;
      }
      throw new Error(`User @${username} not found`);
    } catch (err) {
      console.error(`❌ Failed to lookup @${username}:`, err.response?.data?.detail || err.message);
      return null;
    }
  }

  /**
   * Fetch recent tweets for a user.
   */
  async getUserTweets(userId, sinceId = null) {
    if (!userId) return [];

    try {
      const params = {
        max_results: 20,
        'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets',
        'user.fields': 'username',
        expansions: 'author_id'
      };
      if (sinceId) params.since_id = sinceId;

      const res = await axios.get(`${API_BASE}/users/${userId}/tweets`, {
        params,
        headers: { Authorization: `Bearer ${this.token}` }
      });

      return res.data?.data || [];
    } catch (err) {
      console.error(`❌ Failed to fetch tweets for user ID ${userId}:`, err.response?.data?.detail || err.message);
      return [];
    }
  }
}

module.exports = new TwitterClient();
