// ============================================================
// ab-test-prompt.js — A/B Test: Prompt Design Variants
// ============================================================
//
// Usage:  node ab-test-prompt.js
//
// Fetches tweets once, generates digests with one or more prompt
// variants, saves HTML to ab-test-results/, and sends each as a
// separate email for side-by-side comparison in Gmail.
//
// ── How to add a new prompt variant ─────────────────────────
//
// 1. Copy buildPromptF() and rename it (e.g. buildPromptG).
// 2. Edit the prompt text. The current production prompt lives
//    in src/digest-generator.js — Prompt F is the baseline.
// 3. Add the new variant to the `variants` array in main().
// 4. Run:  node ab-test-prompt.js
// 5. Compare emails in Gmail. If the new variant wins, copy the
//    prompt into buildPrompt() in src/digest-generator.js.
//
// ── Prompt history (2026-04-18) ─────────────────────────────
//
// A (original) — Dense labels ("Technical Design:", "Why it
//     Matters:"), 800px, 6-9 cards. Hard to scan.
// B (scannable) — Too shallow. Lost analytical depth.
// C (insight-pyramid) — Inverted pyramid journalism. Good
//     visual format: blue left-border insights, navy pill
//     headers, rounded card borders.
// D (BLUF thesis-first) — No labels, bold thesis opens each
//     card. Good analytical voice. Georgia serif font.
// E (C format + D voice) — Merged. Language still too dense.
// F (middle register) — WINNER. C's format + D's structure +
//     new language rules: "simplify the grammar, not the ideas."
//     Short sentences, concrete subjects, active verbs, precise
//     distinctions. Before/after examples baked into the prompt.
//
// Key editorial principle: dense writing is a grammar problem,
// not an ideas problem. Complex ideas can be expressed in simple
// sentence structures without losing precision.
// ============================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { parseTweets } = require("./src/tweet-parser");
const { scoreTweets } = require("./src/tweet-scorer");
const { getGoogleAuthClient } = require("./src/auth");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const {
  TWITTERAPI_IO_KEY,
  GEMINI_API_KEY,
  MIN_FAVES_FILTER,
  TIMEZONE,
  TWITTER_USERNAMES,
  RECIPIENT_EMAIL,
} = require("./src/config");

const API_BASE = "https://api.twitterapi.io/twitter";
const MAX_PAGES = 2;
const RATE_LIMIT_RETRY_DELAY = 5000;
const MAX_RETRIES = 2;
const MAX_TWEETS_FOR_AI = 50;

// ── Tweet Fetching ───────────────────────────────────────────

async function fetchPage(query, cursor = null) {
  const params = { query, query_type: "Latest" };
  if (cursor) params.cursor = cursor;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await axios.get(`${API_BASE}/tweet/advanced_search`, {
        params,
        headers: { "X-API-Key": TWITTERAPI_IO_KEY },
      });
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      if (
        (status === 429 || (status >= 500 && status < 600)) &&
        attempt <= MAX_RETRIES
      ) {
        console.warn(`   ⚠ Rate limited (attempt ${attempt}), retrying in 5s...`);
        await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
        continue;
      }
      throw err;
    }
  }
}

function standardizeTweet(t) {
  return {
    id: t.id,
    text: t.text,
    created_at: t.createdAt,
    public_metrics: {
      retweet_count: t.retweetCount || 0,
      reply_count: t.replyCount || 0,
      like_count: t.likeCount || 0,
      quote_count: t.quoteCount || 0,
    },
    entities: t.entities || {},
    author_id: t.author?.id,
    author_name: t.author?.name,
    author_username: t.author?.userName,
  };
}

async function fetchBatch(usernames, sinceDate) {
  if (!usernames || usernames.length === 0) return [];
  const fromClause = usernames.map((u) => `from:${u}`).join(" OR ");
  const query = `(${fromClause}) since:${sinceDate} -is:retweet -is:reply min_faves:${MIN_FAVES_FILTER}`;

  try {
    let allTweets = [];
    let cursor = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchPage(query, cursor);
      const tweets = data?.tweets || [];
      allTweets.push(...tweets.map((t) => standardizeTweet(t)));
      if (!data?.has_next_page || !data?.next_cursor) break;
      cursor = data.next_cursor;
    }
    return allTweets;
  } catch (err) {
    console.error(`   ❌ Batch failed:`, err.response?.data?.message || err.message);
    return [];
  }
}

async function fetchAllTweets(sinceDate) {
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < TWITTER_USERNAMES.length; i += batchSize) {
    batches.push(TWITTER_USERNAMES.slice(i, i + batchSize));
  }

  console.log(`   📦 Fetching ${batches.length} batches in parallel...`);
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const rawTweets = await fetchBatch(batch, sinceDate);
        return parseTweets(rawTweets);
      } catch (err) {
        console.error(`   ❌ Batch failed:`, err.message);
        return [];
      }
    })
  );

  return results.flat();
}

// ── Generate HTML with Gemini ────────────────────────────────

async function generateWithPrompt(prompt, label) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const models = [
    { name: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { name: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ];

  for (const entry of models) {
    try {
      console.log(`   🔄 [${label}] Trying ${entry.label}...`);
      const model = genAI.getGenerativeModel({
        model: entry.name,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 16384,
          thinkingConfig: entry.name.includes("gemini-3")
            ? { thinkingBudget: 4096 }
            : undefined,
        },
      });

      const result = await model.generateContent(prompt);
      const html = result.response
        .text()
        .replace(/^```html\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

      console.log(`   ✅ [${label}] Success with ${entry.label} (${html.length} chars)`);
      return html;
    } catch (err) {
      console.error(`   ❌ [${label}] ${entry.label} failed:`, err.message);
      if (entry === models[models.length - 1]) throw err;
    }
  }
}

// ── Send Email ───────────────────────────────────────────────

async function sendTestEmail(authClient, htmlBody, subject) {
  const gmail = google.gmail({ version: "v1", auth: authClient });

  const messageParts = [
    `To: ${RECIPIENT_EMAIL}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody,
  ];

  const rawMessage = messageParts.join("\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
  return res.data.id;
}

// ── Prompt Variants ──────────────────────────────────────────
// Add new variants here. Each function takes (topTweets, dateString)
// and returns a prompt string.

// Prompt F (current production baseline) — middle register
function buildPromptF(topTweets, dateString) {
  const data = topTweets.map((t) => ({
    username: t.username,
    authorName: t.authorName,
    text: t.text,
    url: t.url,
    timestamp: t.timestamp,
    metrics: t.metrics,
  }));

  const totalTweets = data.length;
  const uniqueAuthors = new Set(data.map((t) => t.authorName)).size;

  return `You are writing a daily intelligence briefing for startup founders.

Task: Analyze ${totalTweets} tweets from AI leaders. Produce a brief that a founder reads in 2-3 minutes and walks away understanding something they didn't before.

AUDIENCE: Seed-to-Series-A software founders. Smart, busy, not AI researchers. They care about: what to build, who to hire, what to buy, when to move.

VOICE & LANGUAGE:
Your goal is to make complex ideas easy to read WITHOUT losing their precision. Follow these rules:

1. SIMPLIFY THE GRAMMAR, NOT THE IDEAS. A sophisticated insight expressed in two short sentences is better than the same insight crammed into one long sentence with nested clauses.

2. Use concrete subjects and active verbs. "Anthropic launched Claude Design" not "Anthropic's entry into design via Claude Design demonstrates..."

3. Break compound sentences into two. If a sentence has a comma followed by a dependent clause, split it.

4. Stay precise. Do not make sweeping generalizations or dramatic claims that go beyond what the source tweets actually say. "Anthropic launched a design tool, putting it in competition with Figma" is precise. "The companies building AI are coming for the apps that use AI" is dramatic and unverifiable.

5. When explaining WHY something matters, be specific about the distinction. Don't collapse nuance into vague language.
   BAD (too dense): "Engineering seniority in AI is now defined by JAX proficiency, signaling a shift from implementation to deep architectural understanding."
   BAD (too vague): "When hiring AI engineers, look for JAX on their resume. It's the clearest sign someone understands how models actually work under the hood."
   GOOD (clear and precise): "JAX experience is becoming a stronger hiring signal than PyTorch for senior AI roles. The distinction matters: PyTorch shows someone can use existing models, JAX shows they can optimize and build new ones."

6. No metaphors or analogies. No jargon without a brief inline explanation. No hedging ("it seems", "arguably"). No filler ("it's worth noting", "interestingly").

---

STRUCTURE:

SECTION 1 — KEY INSIGHTS
3 statements. Each must:
- Be 1-2 SHORT sentences that deliver a specific, precise insight
- State a conclusion supported by the tweet data (not a sweeping generalization)
- Explain the specific distinction or non-obvious connection that makes this worth knowing
- 15-30 words total

SECTION 2 — BRIEFING CARDS (5-7 total)
Organize under 3 pillars:
- 🚀 Tools & Products
- 📊 Industry Moves
- 🔬 Research Worth Knowing
1-3 cards per pillar.

Each card has NO LABELS. Instead:

First line (bold): A thesis statement — what happened and why it matters. 1-2 sentences, concrete and precise. This is the card's headline and insight combined.

Second paragraph: 2-3 supporting sentences. Evidence, context, what specifically changed. Written as flowing prose with short sentences. Include concrete details (names, numbers, specific differences).

Source line: Author names hyperlinked to tweets, prefixed with "via".

SECTION 3 — FOOTER
"${totalTweets} tweets · ${uniqueAuthors} sources · ${dateString}"

---

OUTPUT FORMAT:
Raw HTML only. No markdown fences. Start directly with the opening div.
All styles must be inline (Gmail strips <style> tags).

HTML DESIGN:

Container:
- max-width: 600px, margin: 0 auto, padding: 16px
- background: #ffffff
- font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
- color: #1a1a1a, line-height: 1.6

Header:
- Left-aligned, no banner
- Title: "AI Intelligence Brief" in bold, font-size 20px, color #1a1a2e
- Subtitle: "${dateString}" in font-size 13px, color #6b7280
- Bottom border: 1px solid #e5e7eb, padding-bottom 14px

Key Insights section:
- Section label: "KEY INSIGHTS" in font-size 11px, letter-spacing 1.5px, uppercase, color #6b7280, margin-top 20px, margin-bottom 10px
- Use <ul> with no bullets (list-style: none, padding-left: 0)
- Each <li>: font-size 15px, line-height 1.5, color #1a1a1a, margin-bottom 12px, padding-left 16px, border-left: 3px solid #2563eb

Pillar Headers:
- Compact pill: background #1a1a2e, color #fff, font-size 11px, uppercase, letter-spacing 1px, padding 4px 12px, border-radius 4px, display inline-block, margin-top 28px, margin-bottom 12px

Cards:
- White background (#ffffff), border: 1px solid #e8e8e8, border-radius: 6px
- padding: 16px, margin: 10px 0 14px 0

Card Thesis (first line):
- font-size: 16px, font-weight: bold, color: #1a1a1a, line-height: 1.5
- margin: 0 0 8px 0
- Use a <p> tag, not a heading

Card Body (supporting evidence):
- font-size: 15px, color: #333333, line-height: 1.6
- margin: 0 0 8px 0

Card Source:
- font-size: 12px, color: #9ca3af, margin: 0
- Links: color #2563eb, text-decoration: none
- Prefix "via " before the names

Footer:
- margin-top: 32px, padding-top: 16px, border-top: 1px solid #e5e7eb
- font-size: 12px, color: #9ca3af, text-align: center

---

INTERNAL REASONING (do not output):
For each topic, formulate the THESIS first — the specific, non-obvious conclusion. Then check: is this precise enough that someone could disagree with it? If it's so vague that no one could disagree, it's not an insight. Rewrite it with more specificity.

Input Data:
${JSON.stringify(data, null, 2)}`;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  // Define which variants to test. To compare multiple prompts,
  // add entries here — each gets its own email.
  const variants = [
    { name: "F", label: "Middle Register", build: buildPromptF },
    // Example: { name: "G", label: "Your New Variant", build: buildPromptG },
  ];

  console.log("========================================");
  console.log(`  PROMPT TEST — ${variants.map((v) => v.name).join(", ")}`);
  console.log("========================================\n");

  // 1. Fetch tweets once (shared across all variants)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceDate = yesterday.toISOString().slice(0, 10);
  console.log(`📡 Fetching tweets for ${TWITTER_USERNAMES.length} accounts (since ${sinceDate})...`);

  const parsedTweets = await fetchAllTweets(sinceDate);
  console.log(`📊 Found ${parsedTweets.length} tweets. Scoring...\n`);

  // 2. Score and select top N
  const scored = scoreTweets(parsedTweets);
  const topTweets = scored.slice(0, MAX_TWEETS_FOR_AI);
  console.log(`🎯 Top ${topTweets.length} tweets selected for AI synthesis.\n`);

  // 3. Build date string
  const dateString = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: TIMEZONE,
  }).format(new Date());

  // 4. Generate all variants
  const results = [];
  for (const variant of variants) {
    console.log(`🤖 Generating digest with Prompt ${variant.name}...\n`);
    const prompt = variant.build(topTweets, dateString);
    const html = await generateWithPrompt(prompt, `Prompt ${variant.name} (${variant.label})`);
    results.push({ ...variant, html });
  }

  // 5. Save HTML files
  const resultsDir = path.join(__dirname, "ab-test-results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const r of results) {
    const slug = r.label.toLowerCase().replace(/\s+/g, "-");
    const file = path.join(resultsDir, `prompt-${r.name}-${slug}-${timestamp}.html`);
    fs.writeFileSync(file, r.html);
    console.log(`💾 Saved: ${file}`);
  }

  // 6. Send emails
  console.log(`\n📧 Sending to ${RECIPIENT_EMAIL}...`);
  try {
    const authClient = await getGoogleAuthClient();
    const dateStr = `${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}/${String(yesterday.getUTCDate()).padStart(2, "0")}/${String(yesterday.getUTCFullYear()).slice(-2)}`;

    for (const r of results) {
      const id = await sendTestEmail(
        authClient,
        r.html,
        `[Test ${r.name}] ${r.label} - ${dateStr}`
      );
      console.log(`   ✅ Prompt ${r.name} sent (ID: ${id})`);
    }
  } catch (err) {
    console.error("   ❌ Email send failed:", err.message);
    console.log("   📂 You can still view the HTML files locally.");
  }

  // 7. Summary
  console.log("\n========================================");
  for (const r of results) {
    console.log(`  Prompt ${r.name} (${r.label}): ${r.html.length} chars`);
  }
  console.log("========================================");
  console.log("\n✅ Check your inbox!");
}

main().catch((err) => {
  console.error("❌ A/B test failed:", err);
  process.exit(1);
});
