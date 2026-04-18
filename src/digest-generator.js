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

/**
 * Generate HTML email using Gemini with fallback logic.
 */
async function generateDigestHTML(topTweets) {
  if (topTweets.length === 0) return { html: 'No high-signal updates today.', modelUsed: null };

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
          maxOutputTokens: 16384,
          thinkingConfig: entry.name.includes('gemini-3') ? { thinkingBudget: 4096 } : undefined
        }
      });

      const result = await model.generateContent(prompt);
      const html = result.response.text()
        .replace(/^```html\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      console.log(`✅ Success with ${entry.label} (${html.length} chars)`);
      return { html, modelUsed: entry.name };
    } catch (err) {
      console.error(`   ❌ ${entry.label} failed:`, err.message);
      if (entry === models[models.length - 1]) throw err;
    }
  }
}

module.exports = { generateDigestHTML };
