// ============================================================
// tweet-scorer.js — Weighted Composite Scoring
// ============================================================

const { TWITTER_USERNAMES } = require('./config');

/**
 * Scores tweets based on engagement, recency, and account priority.
 */
function scoreTweets(parsedTweets) {
  if (!Array.isArray(parsedTweets)) return [];

  const now = new Date();
  
  // Calculate max engagement for normalization
  const maxEngagement = Math.max(1, ...parsedTweets.map(t => t.engagementTotal || 0));

  // User priority map (order in config)
  const priorityMap = {};
  const totalUsers = TWITTER_USERNAMES.length;
  TWITTER_USERNAMES.forEach((u, i) => {
    priorityMap[u.toLowerCase()] = totalUsers - i;
  });

  // Weights
  const W_ENGAGEMENT = 0.50;
  const W_RECENCY = 0.30;
  const W_PRIORITY = 0.20;

  const scored = parsedTweets.map(t => {
    // 1. Engagement score (0..1)
    const engagementScore = t.engagementTotal / maxEngagement;

    // 2. Recency score (0..1)
    const hoursAgo = (now - t.tweetDate) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - (hoursAgo / 24));

    // 3. Priority score (0..1)
    const rawPriority = priorityMap[t.username.toLowerCase()] || 0;
    const priorityScore = rawPriority / totalUsers;

    // Composite
    const compositeScore = 
      (W_ENGAGEMENT * engagementScore) +
      (W_RECENCY * recencyScore) +
      (W_PRIORITY * priorityScore);

    return {
      ...t,
      score: Math.round(compositeScore * 1000) / 1000,
      hoursAgo: Math.round(hoursAgo * 10) / 10
    };
  });

  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

module.exports = { scoreTweets };
