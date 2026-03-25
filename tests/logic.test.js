import { describe, it, expect } from 'vitest';
const { parseTweets } = require('../src/tweet-parser');
const { scoreTweets } = require('../src/tweet-scorer');

describe('Tweet Processing Logic', () => {
  const mockTweets = [
    {
      id: '1',
      text: 'This is a very important AI update about a new tool.',
      created_at: new Date().toISOString(),
      public_metrics: { like_count: 100, retweet_count: 50, reply_count: 10, quote_count: 5 }
    },
    {
      id: '2',
      text: 'RT @someone: This is a retweet and should be filtered out.',
      created_at: new Date().toISOString(),
      referenced_tweets: [{ type: 'retweeted', id: '99' }]
    },
    {
      id: '3',
      text: 'Short',
      created_at: new Date().toISOString(),
      public_metrics: { like_count: 10, retweet_count: 2, reply_count: 1, quote_count: 0 }
    }
  ];

  it('should filter out retweets and short tweets', () => {
    const parsed = parseTweets(mockTweets, 'testuser');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('1');
  });

  it('should correctly score tweets', () => {
    const parsed = parseTweets(mockTweets, 'testuser');
    const scored = scoreTweets(parsed);
    expect(scored[0].score).toBeGreaterThan(0);
  });
});
