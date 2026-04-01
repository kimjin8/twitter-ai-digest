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

  return `You are a Senior AI Systems Architect and Technical Scout.
Task: Analyze the following ${data.length} tweets from top AI leaders.

AUDIENCE: Seed-to-Series-A software founders who are non-technical.
They need to stay informed on AI developments that affect their
decisions — hiring, vendor choice, build/buy, technical risk, and
market timing.

---

PILLARS:
- Pillar 1: 🚀 Tools & Products (Technical design, why it matters, stack)
- Pillar 2: 📊 Industry Intelligence (Trends, market shifts, trajectory)
- Pillar 3: 🔬 Research & Discoveries (Papers, core discoveries,
  capabilities/constraints)

---

STEP 1 — TRIAGE (internal reasoning, do not output):
Review all ${data.length} tweets. For each pillar, rank the top 5
candidate topics by FOUNDER ACTIONABILITY: "Would a seed-to-Series-A
software founder change a decision this week based on this?"
- If multiple tweets cover the same underlying story, merge them
  into one candidate and note all sources.
- If a topic is niche to hardware, academia-only, or has no
  near-term product implication, drop it.

STEP 2 — SELECT:
Pick the top 2-3 candidates per pillar. You must have at least 2
and no more than 3 cards per pillar. Total output: 6-9 cards across
all pillars.

STEP 3 — EXECUTIVE SUMMARY:
Write exactly 3 synthesis points. Each MUST correspond to at least
one card in the body. Frame each as a trend with a clear implication
for a founder, not just a topic label.

STEP 4 — WRITE CARDS:
For each selected candidate, write one card with the following
fields:
- Topic: A short, descriptive title for the card (e.g. "LiteLLM
  Supply Chain Breach", "Federal Preemption of AI Regulation").
- Technical Design: Explain the architecture in simple terms.
  Prioritize HOW it works over WHAT it is.
- Why it Matters: One concrete implication for a founder's
  decisions (hiring, vendor choice, build/buy, risk mitigation,
  or market timing).
- Stack (Pillar 1 only) / Trajectory (Pillar 2 only) /
  Capabilities/Constraints (Pillar 3 only).
- Source: All contributing tweet authors (display names, not
  handles), hyperlinked to the tweet URL.

---

OUTPUT FORMAT:
- Raw HTML only. No markdown fences. Start directly with the
  opening div.
- HEADER_DATE: Use "${dateString}" as the date in the header.

HTML DESIGN:
- Container: max-width 800px, centered, light background (#f8f9fa).
- Header: Dark navy (#1a1a2e) full-width banner, white text,
  centered. Title: "🐦 Twitter AI Intelligence Brief". Subtitle:
  HEADER_DATE + "Technical Scout Analysis".
- Executive Summary: White card with light border, labeled
  "Executive Synthesis". Use a <ul> for the 3 points.
- Pillar headers: Rendered as compact colored pill/badge
  (dark navy background, white text, inline-block, rounded
  corners, padding 5px 15px, font-size 13px, uppercase,
  margin-top 25px). NOT full-width bars.
- Cards: White background, 1px solid border (#e1e4e8), padding
  15px, margin 12px 0. No colored backgrounds on cards.
- Card Topic title: Rendered as a bold <h3> (font-size 16px,
  margin-top 0) at the top of each card, before Technical Design.
- Card fields: "Technical Design:", "Why it Matters:", "Stack:"
  / "Trajectory:" / "Capabilities/Constraints:" each in their
  own <p> tag with the label in <strong>.
- Source line: Smaller font (font-size 13px, color #586069).
  "Source: " followed by hyperlinked authorName. Link color
  #0366d6.
- Typography: System font stack (-apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, Helvetica, Arial, sans-serif). Body text
  color #24292e. Line-height 1.5.

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
