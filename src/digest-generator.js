// ============================================================
// digest-generator.js — Gemini AI Prompt + Fallback
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  GEMINI_API_KEY,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  STABLE_FALLBACK_MODEL,
  TIMEZONE,
} = require('./config');

// Healthy digests run ~8,500 chars. The 2026-06-23 truncation bug produced
// 1,741 chars (header + 2 insights, then cut off mid-tag). 3,000 is a safe
// floor: well below any real digest, well above any truncated one.
const MIN_DIGEST_HTML_LENGTH = 3000;

// Sentinel returned when there is nothing to synthesize. Callers skip the
// structural digest validation for this value.
const NO_CONTENT_HTML = 'No high-signal updates today.';

/**
 * Build the prompt for Gemini.
 *
 * Prompt design: "Middle register" — simplify the grammar, not the ideas.
 * Tested as Prompt F during A/B testing (2026-04-18). See ab-test-prompt.js
 * for the full history of prompt variants (A-F) and design rationale.
 *
 * Key principles:
 * - Thesis-first cards (BLUF): bold thesis opens each card, no labels
 * - Middle-register language: short sentences, concrete subjects, active
 *   verbs, precise distinctions — no jargon, no metaphors, no sweeping claims
 * - Inverted pyramid: KEY INSIGHTS up top, then 5-7 cards across 3 pillars
 * - Gmail-safe: all styles inline, 600px container
 *
 * To iterate on this prompt, use ab-test-prompt.js to generate side-by-side
 * comparisons before modifying this file.
 */
function buildPrompt(topTweets, dateString) {
  const data = topTweets.map(t => ({
    username: t.username,
    authorName: t.authorName,
    text: t.text,
    url: t.url,
    timestamp: t.timestamp,
    metrics: t.metrics
  }));

  const totalTweets = data.length;
  const uniqueAuthors = new Set(data.map(t => t.authorName)).size;

  return `You are writing a daily intelligence briefing for startup founders.

Task: Analyze ${totalTweets} tweets from AI leaders. Produce a brief that a founder reads in 2-3 minutes and walks away understanding something they didn't before.

AUDIENCE: Seed-to-Series-A software founders. Smart, busy, not AI researchers. They care about: what to build, who to hire, what to buy, when to move.

VOICE & LANGUAGE:
Your goal is to make complex ideas easy to read WITHOUT losing their precision. Follow these rules:

1. SIMPLIFY THE GRAMMAR, NOT THE IDEAS. A sophisticated insight expressed in two short sentences is better than the same insight crammed into one long sentence with nested clauses.

2. Use concrete subjects and active verbs. "Anthropic launched Claude Design" not "Anthropic's entry into design via Claude Design demonstrates..."

3. Break compound sentences into two. If a sentence has a comma followed by a dependent clause, split it.

4. Stay precise. Do not make sweeping generalizations or dramatic claims that go beyond what the source tweets actually say. "Anthropic launched a design tool, putting it in competition with Figma" is precise. "The companies building AI are coming for the apps that use AI" is dramatic and unverifiable.

   PRESERVE THE SOURCE'S CERTAINTY. If a tweet frames a claim as conditional, leaked, unverified, rumored, predicted, or reported by someone else, you MUST carry that framing through. Do not upgrade a hedged or second-hand claim into an established fact. "If the leaked data is right, OpenAI runs 40%+ gross margins serving customers" must stay conditional — write "Leaked data suggests OpenAI runs ~40% gross margins on serving customers," NOT "OpenAI is achieving 40% gross margins." Also preserve the exact meaning of the claim: "serving customers" (running models for users) is not "customer service."

5. When explaining WHY something matters, be specific about the distinction. Don't collapse nuance into vague language.
   BAD (too dense): "Engineering seniority in AI is now defined by JAX proficiency, signaling a shift from implementation to deep architectural understanding."
   BAD (too vague): "When hiring AI engineers, look for JAX on their resume. It's the clearest sign someone understands how models actually work under the hood."
   GOOD (clear and precise): "JAX experience is becoming a stronger hiring signal than PyTorch for senior AI roles. The distinction matters: PyTorch shows someone can use existing models, JAX shows they can optimize and build new ones."

6. No metaphors or analogies. No jargon without a brief inline explanation. No filler ("it's worth noting", "interestingly"). Cut YOUR OWN hedging ("it seems", "arguably", "this could suggest") — but this is not license to strip a hedge that belongs to the source. A conditional or unverified claim from a tweet (rule 4) keeps its qualifier; what you remove is your own editorial uncertainty, not the source's.

---

STRUCTURE:

SECTION 1 — KEY INSIGHTS
3 statements. Each must:
- Be 1-2 SHORT sentences that deliver a specific, precise insight
- State a conclusion supported by the tweet data (not a sweeping generalization)
- Explain the specific distinction or non-obvious connection that makes this worth knowing
- 15-30 words total (the source line below does not count toward this)
- End with a source line: the author name(s) hyperlinked to the exact source tweet URL(s) the insight draws from, prefixed with "via" — identical in style to the briefing-card source line. Every insight MUST be traceable to a specific tweet in the Input Data. If an insight rests on a number, claim, or quote, the linked tweet(s) must be the one(s) that actually contain it. Never attribute an insight to a tweet that does not support it.

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
- Each <li>: font-size 15px, line-height 1.5, color #1a1a1a, margin-bottom 14px, padding-left 16px, border-left: 3px solid #2563eb
- The insight text sits in a <span> or <p> (margin 0). On the line below it, render the source line: font-size 12px, color #9ca3af, margin-top 4px, prefixed with "via ". Author links: color #2563eb, text-decoration none, pointing to the source tweet URL.

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

/**
 * Validate that a generated digest is complete and well-formed.
 *
 * This is the guard the 2026-06-23 truncation bug bypassed. A Gemini response
 * that finishes with MAX_TOKENS returns HTTP 200 with *partial* HTML and does
 * NOT throw — so `generateContent` "succeeds" with a half-built digest (header
 * + 2 insights, no cards, no footer, ending mid-tag at "<div style"). The old
 * code accepted that and emailed it. Treat any degraded output as a failure so
 * the caller can fall back to another model or abort, never send garbage.
 *
 * Each check targets a distinct failure mode of the same class — "the model
 * returned 200 but the output is incomplete":
 *   - finishReason: the model itself signalled it stopped early.
 *   - length: a truncated digest is far shorter than a real one.
 *   - endsWith('>'): truncation cuts mid-tag.
 *   - balanced <div>: truncation leaves opened containers unclosed.
 *   - KEY INSIGHTS / footer: required sections must both be present, proving
 *     the document rendered top to bottom (the footer is emitted last).
 *
 * @param {string} html         Cleaned HTML returned by the model.
 * @param {string} [finishReason] Gemini candidate finishReason, if available.
 * @returns {{ valid: boolean, reason: string }}
 */
function validateDigestHTML(html, finishReason) {
  if (finishReason && finishReason !== 'STOP') {
    return { valid: false, reason: `model stopped early (finishReason=${finishReason})` };
  }
  if (!html || typeof html !== 'string') {
    return { valid: false, reason: 'empty output' };
  }
  const trimmed = html.trim();
  if (trimmed.length < MIN_DIGEST_HTML_LENGTH) {
    return { valid: false, reason: `output too short (${trimmed.length} < ${MIN_DIGEST_HTML_LENGTH} chars)` };
  }
  if (!trimmed.endsWith('>')) {
    return { valid: false, reason: 'output ends mid-tag (response was cut off)' };
  }
  const openDivs = (trimmed.match(/<div\b/gi) || []).length;
  const closeDivs = (trimmed.match(/<\/div>/gi) || []).length;
  if (openDivs !== closeDivs) {
    return { valid: false, reason: `unbalanced <div> tags (${openDivs} open, ${closeDivs} close)` };
  }
  if (!/KEY INSIGHTS/i.test(trimmed)) {
    return { valid: false, reason: 'missing KEY INSIGHTS section' };
  }
  // Footer format: "N tweets · M sources · <date>". It is the last thing the
  // model emits, so its presence proves the body completed.
  if (!/tweets\s*·\s*\d+\s*sources/i.test(trimmed)) {
    return { valid: false, reason: 'missing footer (digest body incomplete)' };
  }
  return { valid: true, reason: 'ok' };
}

/**
 * Generate HTML email using Gemini with fallback logic.
 */
async function generateDigestHTML(topTweets) {
  if (topTweets.length === 0) return { html: NO_CONTENT_HTML, modelUsed: null };

  console.log('🤖 Generating AI digest...');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  const dateString = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: TIMEZONE
  }).format(new Date());

  const prompt = buildPrompt(topTweets, dateString);

  const models = [
    { name: PRIMARY_MODEL, label: 'Gemini 3 Flash' },
    { name: FALLBACK_MODEL, label: 'Gemini 3.1 Flash Lite' },
    { name: STABLE_FALLBACK_MODEL, label: 'Gemini 2.5 Flash' }
  ];

  for (const entry of models) {
    try {
      console.log(`   🔄 Trying ${entry.label}...`);
      const model = genAI.getGenerativeModel({
        model: entry.name,
        generationConfig: {
          temperature: 0.2,
          // Raised from 16384: for Gemini 3, thinking tokens count against
          // maxOutputTokens, so a long reasoning chain (thinkingBudget below)
          // could starve the visible output and truncate the digest. Give the
          // body ample headroom on top of the thinking budget.
          maxOutputTokens: 32768,
          thinkingConfig: entry.name.includes('gemini-3') ? { thinkingBudget: 2048 } : undefined
        }
      });

      const result = await model.generateContent(prompt);
      const finishReason = result.response.candidates?.[0]?.finishReason;
      const html = result.response.text()
        .replace(/^```html\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      // Truncated/degraded responses return HTTP 200 and do NOT throw. Validate
      // and throw on failure so the catch below advances to the next model
      // instead of emailing a broken digest.
      const { valid, reason } = validateDigestHTML(html, finishReason);
      if (!valid) {
        throw new Error(`invalid digest output: ${reason} (${html.length} chars)`);
      }

      console.log(`✅ Success with ${entry.label} (${html.length} chars)`);
      return { html, modelUsed: entry.name };
    } catch (err) {
      console.error(`   ❌ ${entry.label} failed:`, err.message);
      if (entry === models[models.length - 1]) throw err;
    }
  }
}

module.exports = { generateDigestHTML, validateDigestHTML, NO_CONTENT_HTML, MIN_DIGEST_HTML_LENGTH };
