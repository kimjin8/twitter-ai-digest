// ============================================================
// tweet-parser.js — Tweet Cleaning and Filtering
// ============================================================

/**
 * Parses and filters raw tweet data from the X API.
 */
function parseTweets(rawTweets, username) {
  if (!Array.isArray(rawTweets)) return [];

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return rawTweets
    .map(t => {
      const tweetDate = new Date(t.created_at);
      
      // Determine the correct username (batched search provides author_username)
      const u = t.author_username || username;

      // Basic metrics
      const likes = t.public_metrics?.like_count || 0;
      const retweets = t.public_metrics?.retweet_count || 0;
      const replies = t.public_metrics?.reply_count || 0;
      const quotes = t.public_metrics?.quote_count || 0;

      // Check if it's a retweet or reply
      const isRetweet = t.referenced_tweets?.some(ref => ref.type === 'retweeted');
      const isReply = !!t.referenced_tweets?.some(ref => ref.type === 'replied_to');

      return {
        id: t.id,
        username: u,
        text: t.text,
        url: `https://x.com/${u}/status/${t.id}`,
        timestamp: t.created_at,
        tweetDate,
        metrics: { likes, retweets, replies, quotes },
        engagementTotal: likes + retweets + replies + quotes,
        isRetweet,
        isReply,
        entities: t.entities
      };
    })
    .filter(t => {
      // 1. Must be from last 24 hours
      if (t.tweetDate < twentyFourHoursAgo) return false;
      
      // 2. Remove retweets (we want original thoughts)
      if (t.isRetweet) return false;

      // 3. Remove replies (usually low context for a digest)
      if (t.isReply) return false;

      // 4. Remove very short tweets (low signal)
      if (t.text.length < 20) return false;

      return true;
    });
}

module.exports = { parseTweets };
