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
    text: t.text,
    url: t.url,
    timestamp: t.timestamp,
    metrics: t.metrics
  }));

  return `You are a Senior AI Systems Architect and Technical Scout.
Task: Analyze the following ${data.length} tweets from top AI leaders. Extract high-signal updates for a non-technical startup founder. 

Goal:
1. Depth in content with detailed & accurate explanations.
2. Sharp & glanceable for the big picture.

Pillars:
- Pillar 1: 🚀 Tools & Products (Technical design, why it matters, stack)
- Pillar 2: 📊 Industry Intelligence (Trends, market shifts, trajectory)
- Pillar 3: 🔬 Research & Discoveries (Papers, core discoveries, capabilities/constraints)

Rules:
- NO REPEATS: Each specific piece of news only once.
- PRIORITY: How over What. Explain architecture/design in simple terms.
- OUTPUT: Raw HTML only. No markdown fences. Start directly with the opening div.
- HEADER_DATE: Use "${dateString}" as the date in the header.

HTML Design:
- Header: Dark navy (#1a1a2e), title "🐦 Twitter AI Intelligence Brief", subtitle showing the HEADER_DATE and "Technical Scout Analysis".
- Summary: 3 high-level synthesis points (trends).
- Cards: White background, 1px border (#e1e4e8), 15px padding, 12px margin.
- Tags: Pill badges color-coded per pillar.
- Register/Source: Links to tweet.

Input Data:
${JSON.stringify(data, null, 2)}`;
}

/**
 * Generate HTML email using Gemini with fallback logic.
 */
async function generateDigestHTML(topTweets) {
  if (topTweets.length === 0) return 'No high-signal updates today.';

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
      return html;
    } catch (err) {
      console.error(`   ❌ ${entry.label} failed:`, err.message);
      if (entry === models[models.length - 1]) throw err;
    }
  }
}

module.exports = { generateDigestHTML };
