# Digest Quality Evaluation Framework

Version 1.0 — April 2026

## Purpose

A structured rubric for evaluating the quality of the Twitter AI Intelligence Brief digest. Used for A/B testing account list changes, scoring engine tuning, and prompt optimization.

## Target Audience

Seed-to-Series-A software founders who are non-technical. They need AI developments that affect: hiring, vendor choice, build/buy decisions, technical risk assessment, and market timing.

---

## Six Dimensions (each scored 1-10)

### 1. Signal Density
**What it measures:** Ratio of actionable, founder-relevant tweets to total volume fetched.

**Why it matters:** Every tweet costs API credits and AI tokens. Low-signal tweets dilute the AI synthesis.

**How to score:**
- 9-10: >80% of fetched tweets have engagement >= 50 and contain original analysis
- 7-8: 60-80% high-signal
- 5-6: 40-60% high-signal
- 3-4: 20-40% high-signal
- 1-2: <20% high-signal (dominated by spam/filler)

**Quantitative proxy:** `high_signal_tweets / total_tweets` where high-signal = engagement >= 50.

---

### 2. Pillar Balance
**What it measures:** Coverage across the three digest pillars:
- **Tools & Products** — New AI tools, product launches, developer tooling, infrastructure
- **Industry Intelligence** — Funding, M&A, market shifts, regulatory, competitive dynamics
- **Research & Discoveries** — Papers, model capabilities, benchmarks, alignment findings

**Why it matters:** A lopsided digest (e.g., 90% research, 10% tools) leaves founders blind to categories that affect their decisions.

**How to score:**
- 9-10: All three pillars have 2-3 cards in the final digest; no pillar >50%
- 7-8: All three pillars present, one slightly dominant (40-60%)
- 5-6: One pillar clearly dominates (>60%)
- 3-4: One pillar is missing entirely
- 1-2: Only one pillar covered

**Quantitative proxy:** Classify each top-50 tweet into a pillar, measure distribution.

---

### 3. Source Diversity
**What it measures:** How many distinct accounts contribute meaningful signal in the top 50 scored tweets.

**Why it matters:** Over-reliance on 1-2 voices creates echo chamber risk and single-point-of-failure if those accounts go silent or change behavior.

**How to score:**
- 9-10: 20+ unique authors in top 50; no single author >10% of volume
- 7-8: 15-20 unique authors; no single author >15%
- 5-6: 10-15 unique authors; 1-2 authors dominate >20%
- 3-4: 5-10 unique authors; 3+ accounts produce >50% of volume
- 1-2: <5 unique authors; 1-2 accounts produce >70% of volume

**Quantitative proxy:** `unique_authors_in_top_50` and `max_author_volume / total_volume`.

---

### 4. Founder Actionability
**What it measures:** Would a founder change a decision THIS WEEK based on the digest content?

Decision categories:
- Hiring (team composition, role priorities)
- Vendor choice (which AI provider/tool to use)
- Build vs. buy (make internally or adopt external solution)
- Technical risk (security, dependency, architecture decisions)
- Market timing (when to launch, pivot, raise)

**Why it matters:** This is the entire point of the digest. Information that doesn't affect decisions is entertainment, not intelligence.

**How to score:**
- 9-10: 5+ tweets in top 50 would trigger a concrete founder action
- 7-8: 3-4 clearly actionable tweets
- 5-6: 1-2 actionable tweets, rest is "good to know"
- 3-4: No directly actionable tweets; mostly awareness-level
- 1-2: Content is academic, cultural, or too niche to affect decisions

**Assessment method:** Review the top 50 tweets and ask "what would I DO differently after reading this?"

---

### 5. Freshness & Exclusivity
**What it measures:** Are these breaking/insider insights, or rehashed mainstream news?

**Why it matters:** If it's already on TechCrunch, the digest adds no value. Founders subscribe for signal they can't easily get elsewhere.

**How to score:**
- 9-10: Majority of tweets are first-hand accounts, insider perspectives, or analysis not widely available
- 7-8: Mix of insider signal and curated mainstream news with added context
- 5-6: Mostly mainstream news, some original commentary
- 3-4: Predominantly reshared articles with minimal original analysis
- 1-2: Entirely aggregated/rehashed content

**Assessment method:** For each top-50 tweet, ask "could I have found this on a mainstream tech news site today?"

---

### 6. Noise Floor
**What it measures:** Inverse of noise. How much filler pollutes the raw tweet feed before scoring/filtering.

Noise includes: hashtag spam, self-promotion, memes, "woohoo!!!", generic reshares, non-AI content, personal anecdotes without professional insight.

**Why it matters:** Noise wastes API credits, consumes AI tokens, and can leak into the final digest if the scoring/filtering isn't perfect.

**How to score:**
- 9-10: <5% of tweets are noise
- 7-8: 5-15% noise
- 5-6: 15-30% noise
- 3-4: 30-50% noise
- 1-2: >50% noise (most tweets are filler)

**Quantitative proxy:** Manual or AI classification of raw tweets as signal vs. noise.

---

## Running an A/B Test

### Script

```bash
cd twitter-ai-digest
node ab-test.js
```

### What it does

1. Fetches tweets for both account lists (List A and List B) from the last 24 hours
2. Parses, filters (removes retweets/replies/short tweets), and scores all tweets
3. Computes quantitative metrics for both lists
4. Sends the top-50 tweets from each list to Gemini for qualitative evaluation against this framework
5. Outputs a comparison table, AI scores, and recommended changes
6. Saves all data to `ab-test-results/`

### Key Metrics to Watch

| Metric | Target | Red Flag |
|---|---|---|
| Active Rate | >50% | <30% means too many dead accounts |
| Signal Density | >70% | <40% means noise is dominating |
| Avg Engagement | >200 | <50 means low-quality content |
| Top 50 Unique Authors | >15 | <10 means echo chamber |
| Noise from top 2 accounts | <20% of total | >40% means list is broken |

### Modifying the Test

Edit `LIST_A` and `LIST_B` arrays in `ab-test.js` to compare different account combinations. The script is self-contained — it doesn't use the `.env` TWITTER_USERNAMES.

---

## When to Re-evaluate

- After any account list change
- Monthly, to detect accounts that have gone silent or changed posting behavior
- After changing the scoring weights in `tweet-scorer.js`
- After changing the AI prompt in `digest-generator.js`
