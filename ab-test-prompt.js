// ============================================================
// ab-test-prompt.js — A/B Test: Prompt Design Variants
// ============================================================
// Usage: node ab-test-prompt.js
// Fetches tweets once, generates digests with different prompts,
// sends all as separate emails for side-by-side comparison.
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

// ── Tweet Fetching (reused from ab-test.js) ───────────────

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

// ── Prompt C: Insight-Led Pyramid ─────────────────────────
// Philosophy: Lead each card with the NON-OBVIOUS INSIGHT (the "aha"),
// then provide supporting detail below in smaller text.
// Like a newspaper: headline captures the insight, first paragraph
// delivers the key learning, subsequent paragraphs add context.

function buildPromptC(topTweets, dateString) {
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

  return `You are a senior editor at a top-tier business intelligence newsletter. You write like The Economist meets Morning Brew: sharp, insightful, no fluff — but never dumbed down.

Task: Analyze ${totalTweets} tweets from AI leaders and distill them into a daily intelligence brief.

AUDIENCE: Seed-to-Series-A software founders. They are smart but not deeply technical. They read this over morning coffee in 2-3 minutes. They want to LEARN something that changes how they think — not just be told what happened or what to do.

VOICE & STYLE:
- Authoritative but conversational. Write like a smart friend who works in tech, not a consultant.
- Lead every card with the INSIGHT — the non-obvious conclusion, the "aha", the thing they didn't know before reading this. Not "X happened" and not "You should do Y." The insight is WHY it matters in a way they hadn't considered.
- Keep sentences short and punchy. Vary sentence length for rhythm.
- No forced metaphors or analogies. No jargon without explanation.
- Never use: "paradigm", "leverage", "ecosystem", "game-changer", "disrupt".
- Use specific examples over abstract claims.

---

STRUCTURE (inverted pyramid — most important info first):

SECTION 1 — THREE KEY INSIGHTS
Write exactly 3 bullet points. Each must:
- Be 1-2 sentences that deliver a genuine insight or non-obvious conclusion
- Teach the reader something — change how they think about a decision
- NOT be a command ("You should...") or a label ("The Rise of X")
- Instead, be a sharp observation: "AI models now improve every 60 days, which means any workaround you build today will be obsolete by summer." or "The real moat in AI products isn't the model — it's the reliability layer that prevents agents from failing silently."

SECTION 2 — CARDS (5-7 total across 3 pillars)
Pillars:
- 🚀 Tools & Products
- 📊 Industry Moves
- 🔬 Research Worth Knowing

Rules:
- 1-3 cards per pillar. Total: 5-7 cards.
- Merge tweets covering the same story. Drop anything purely academic.

Each card has exactly 3 parts:

1. HEADLINE: A short, specific title — what happened. Under 12 words.
   Good: "Anthropic releases Opus 4.7 with major reasoning improvements"
   Bad: "New AI Model Release" (too vague)

2. LEAD PARAGRAPH (the insight): 2-3 sentences. This is the most important part of the card. It answers: "What is the non-obvious takeaway? What should a founder understand differently after reading this?" Write it in normal prose — no label, no "Why it Matters:" prefix. Just the insight, clearly stated. This paragraph should be readable on its own — if someone reads ONLY the headline and this paragraph, they got 90% of the value.

3. DETAIL (optional deeper context): 1-2 sentences in smaller text. Background information, how it works, or what to watch next. This is for the curious reader — most will skip it.

4. SOURCE: Author display names hyperlinked to tweet URLs.

SECTION 3 — FOOTER
One line: "Curated from ${totalTweets} tweets by ${uniqueAuthors} AI leaders · ${dateString}"

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

Three Key Insights section:
- Section label: "KEY INSIGHTS" in font-size 11px, letter-spacing 1.5px, uppercase, color #6b7280, margin-top 20px, margin-bottom 10px
- Use <ul> with no bullets (list-style: none, padding-left: 0)
- Each <li>: font-size 15px, line-height 1.5, color #1a1a1a, margin-bottom 12px, padding-left 16px, border-left: 3px solid #2563eb
- These should feel like standalone insights you could tweet

Pillar Headers:
- Compact pill: background #1a1a2e, color #fff, font-size 11px, uppercase, letter-spacing 1px, padding 4px 12px, border-radius 4px, display inline-block, margin-top 28px, margin-bottom 12px

Cards:
- White background (#ffffff), border: 1px solid #e8e8e8, border-radius: 6px
- padding: 16px, margin: 10px 0 14px 0

Card Headline:
- font-size: 16px, font-weight: bold, color: #1a1a1a, margin: 0 0 8px 0
- Use <p> tag, not <h3>

Card Lead Paragraph (the insight):
- font-size: 15px, color: #1a1a1a, line-height: 1.6, margin: 0 0 10px 0
- This is normal-weight body text — it should feel like reading a well-written article, not scanning labels.

Card Detail:
- font-size: 13px, color: #6b7280, line-height: 1.5, margin: 0 0 8px 0

Card Source:
- font-size: 12px, color: #9ca3af, margin: 0
- Links: color #2563eb, text-decoration none

Footer:
- margin-top: 32px, padding-top: 16px, border-top: 1px solid #e5e7eb
- font-size: 12px, color: #9ca3af, text-align: center

---

INTERNAL REASONING (do not output):
For each tweet cluster, ask: "What would surprise a smart founder who doesn't follow AI twitter? What would change how they think about a decision?" If the answer is nothing, drop it. The insight is never "X is important" — it's the specific, non-obvious reason WHY.

Input Data:
${JSON.stringify(data, null, 2)}`;
}

// ── Prompt D: BLUF / Thesis-First ─────────────────────────
// Philosophy: No labels at all. Each card opens with a bold thesis
// statement (the insight), followed by 2-3 sentences of evidence.
// Like an intelligence briefing: bottom line up front.

function buildPromptD(topTweets, dateString) {
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

  return `You are writing a daily intelligence briefing for startup founders. Your format is BLUF — Bottom Line Up Front. Every section leads with the conclusion, then supports it.

Task: Analyze ${totalTweets} tweets from AI leaders. Produce a brief that a founder reads in 2 minutes and walks away smarter.

AUDIENCE: Seed-to-Series-A software founders. Smart but not AI researchers. They care about: what to build, who to hire, what to buy, when to move.

VOICE:
- Direct and confident. State conclusions, not possibilities.
- Every card starts with a bold thesis — not a headline about what happened, but what it MEANS.
- Write like a sharp analyst, not a reporter. Reporters say "X launched Y." Analysts say "Y changes the calculus on Z because..."
- Short sentences. No filler words. No hedging ("it seems", "it appears", "arguably").
- No metaphors. No jargon without brief explanation.

---

STRUCTURE:

SECTION 1 — BOTTOM LINE
3 bold statements that are the most important things a founder should know today. Each is:
- A declarative sentence stating a conclusion (not a question, not a command)
- Specific enough to be falsifiable
- 15-25 words
Example: "Custom AI workarounds have a 60-day shelf life — models are improving fast enough to make them obsolete."

SECTION 2 — BRIEFING CARDS (5-7 total)
Organize under 3 pillars:
- 🚀 Tools & Products
- 📊 Industry Moves
- 🔬 Research Worth Knowing
1-3 cards per pillar.

Each card has NO LABELS (no "Technical Design:", no "Why it Matters:", no "Context:"). Instead:

First line: A bold thesis statement. This IS the card's headline and insight combined. It states what happened AND why it matters in one sentence. 12-20 words.
Example: "Opus 4.7 is a big enough jump that your prompt engineering tricks from last month may not apply."
Example: "JAX on a resume now separates senior AI engineers from everyone else."

Second paragraph: 2-3 supporting sentences. Evidence, context, what specifically changed. Written as flowing prose, not labeled fields. Include concrete details (names, numbers, what specifically is different).

Source line: Author names hyperlinked to tweets.

SECTION 3 — FOOTER
"${totalTweets} tweets · ${uniqueAuthors} sources · ${dateString}"

---

OUTPUT FORMAT:
Raw HTML only. No markdown fences. Start directly with the opening div.
All styles must be inline (Gmail strips <style> tags).

HTML DESIGN:

Container:
- max-width: 600px, margin: 0 auto, padding: 20px
- background: #ffffff
- font-family: Georgia, 'Times New Roman', serif
- color: #111111, line-height: 1.7

Header:
- Left-aligned
- Title: "The AI Brief" in bold, font-size 22px, color #111111, font-family Georgia
- Date: "${dateString}" in font-size 13px, color #888888, margin-top 2px
- Divider: 2px solid #111111, margin-top 12px, margin-bottom 0, width 40px (short accent line, not full width)

Bottom Line section:
- No section label. Starts immediately after header.
- margin-top: 20px
- Each statement in its own <p> tag: font-size 16px, font-weight bold, color #111111, line-height 1.5, margin: 0 0 14px 0, padding-left: 14px, border-left: 3px solid #111111

Pillar Headers:
- Simple text, not a pill/badge
- font-size: 12px, text-transform: uppercase, letter-spacing: 2px, color: #888888, margin-top: 32px, margin-bottom: 8px, font-family: -apple-system, sans-serif
- A thin 1px solid #dddddd line below (use border-bottom, padding-bottom 6px)

Cards:
- No border, no background color. Clean and minimal.
- padding: 0, margin: 16px 0 24px 0
- Separated by whitespace only (the pillar header + spacing provides visual grouping)

Card Thesis (first line):
- font-size: 16px, font-weight: bold, color: #111111, line-height: 1.5
- margin: 0 0 6px 0
- This is a <p> tag, not a heading

Card Body (supporting evidence):
- font-size: 15px, color: #333333, line-height: 1.7
- margin: 0 0 8px 0

Card Source:
- font-size: 12px, color: #999999
- Links: color #2563eb, text-decoration: none
- Prefix "via " before the names (not "Source:")

Footer:
- margin-top: 40px, padding-top: 16px, border-top: 1px solid #dddddd
- font-size: 12px, color: #999999, text-align: center
- font-family: -apple-system, sans-serif

---

INTERNAL REASONING (do not output):
For each topic, formulate the THESIS first. If you can't state a clear thesis — a non-obvious conclusion that a founder would remember — the topic isn't worth including. "X launched Y" is not a thesis. "Y means founders should reconsider Z" is a thesis.

Input Data:
${JSON.stringify(data, null, 2)}`;
}

// ── Generate HTML with Gemini ─────────────────────────────

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

// ── Send Email ────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────

// ── Prompt E: D's voice + C's format (deprecated, see F) ──

// ── Prompt F: Middle-register — clear grammar, precise ideas ──
// Keeps D's thesis-first structure and C's visual design,
// but writes in a middle register: short sentences, concrete
// subjects, no sweeping claims, no dumbing down.

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

async function main() {
  console.log("========================================");
  console.log("  PROMPT TEST — F (Middle Register)");
  console.log("========================================\n");

  // 1. Fetch tweets once
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

  // 4. Generate digest
  console.log("🤖 Generating digest with Prompt F...\n");
  const promptF = buildPromptF(topTweets, dateString);
  const htmlF = await generateWithPrompt(promptF, "Prompt F (Middle Register)");

  // 5. Save HTML file
  const resultsDir = path.join(__dirname, "ab-test-results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileF = path.join(resultsDir, `prompt-F-middle-register-${timestamp}.html`);
  fs.writeFileSync(fileF, htmlF);
  console.log(`\n💾 Saved: ${fileF}`);

  // 6. Send email
  console.log(`\n📧 Sending to ${RECIPIENT_EMAIL}...`);
  try {
    const authClient = await getGoogleAuthClient();
    const dateStr = `${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}/${String(yesterday.getUTCDate()).padStart(2, "0")}/${String(yesterday.getUTCFullYear()).slice(-2)}`;

    const idF = await sendTestEmail(
      authClient,
      htmlF,
      `[Test F] Middle Register - ${dateStr}`
    );
    console.log(`   ✅ Prompt F sent (ID: ${idF})`);
  } catch (err) {
    console.error("   ❌ Email send failed:", err.message);
    console.log("   📂 You can still view the HTML file locally.");
  }

  // 7. Summary
  console.log("\n========================================");
  console.log(`  Prompt F (Middle Register): ${htmlF.length} chars`);
  console.log("========================================");
  console.log("\n✅ Check your inbox!");
}

main().catch((err) => {
  console.error("❌ A/B test failed:", err);
  process.exit(1);
});
