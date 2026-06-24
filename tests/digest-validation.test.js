import { describe, it, expect } from 'vitest';
const {
  validateDigestHTML,
  buildPrompt,
  MIN_DIGEST_HTML_LENGTH,
} = require('../src/digest-generator');

// ── Fixtures ────────────────────────────────────────────────
// A structurally complete digest that mirrors the real email template:
// balanced <div>s, KEY INSIGHTS section, footer last, length well over the
// floor. Built programmatically so it comfortably clears MIN_DIGEST_HTML_LENGTH.
function buildGoodHtml() {
  const card = `<div style="border:1px solid #e8e8e8;padding:16px;margin:10px 0;">
      <p style="font-weight:bold;margin:0 0 8px 0;">A precise thesis about a real AI development that matters to founders.</p>
      <p style="margin:0 0 8px 0;">Two or three supporting sentences with concrete detail, names, and numbers that explain exactly what changed and why it is worth knowing today.</p>
      <p style="margin:0;">via <a href="https://x.com/x/status/1">Someone</a></p>
    </div>`;
  const cards = card.repeat(8);
  return `<div style="max-width:600px;margin:0 auto;padding:16px;">
    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:14px;">AI Intelligence Brief — June 22, 2026</div>
    <div>
      <p style="text-transform:uppercase;">KEY INSIGHTS</p>
      <ul style="list-style:none;padding-left:0;">
        <li>Insight one is specific and precise.</li>
        <li>Insight two draws a real, non-obvious distinction.</li>
        <li>Insight three connects two facts that matter.</li>
      </ul>
    </div>
    ${cards}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">50 tweets · 17 sources · June 22, 2026</div>
  </div>`;
}

const GOOD_HTML = buildGoodHtml();

// Long body that was cut off mid-tag at "<div style" — the exact signature of
// the 2026-06-23 incident, but long enough to pass the length floor so it
// exercises the structural guards (endsWith / balanced divs / missing footer)
// rather than tripping the length check first.
const LONG_TRUNCATED_HTML = GOOD_HTML.split('50 tweets')[0] + '<div style';

// The real-world regression: the actual ~1,741-char shape Gemini emitted that
// day. Header + 2 insights, no cards, no footer, ending mid-tag.
const REAL_INCIDENT_HTML = `<div style="max-width:600px;margin:0 auto;padding:16px;">
  <div style="border-bottom:1px solid #e5e7eb;">
    <p style="font-weight:bold;">AI Intelligence Brief</p>
    <p>June 23, 2026</p>
  </div>
  <p style="text-transform:uppercase;">KEY INSIGHTS</p>
  <ul style="list-style:none;">
    <li>LLM interfaces are shifting from standalone apps to persistent, asynchronous team members.</li>
    <li>NVIDIA's new open-source speech model runs on CPUs with 80ms latency.</li>
  </ul>
  <div style`;

describe('validateDigestHTML', () => {
  it('accepts a complete, well-formed digest', () => {
    const res = validateDigestHTML(GOOD_HTML, 'STOP');
    expect(res.valid).toBe(true);
  });

  it('accepts a complete digest even when finishReason is unavailable', () => {
    // Pre-send gate calls without a finishReason — must still pass.
    expect(validateDigestHTML(GOOD_HTML).valid).toBe(true);
  });

  it('rejects a response that stopped early (MAX_TOKENS) — the root-cause guard', () => {
    const res = validateDigestHTML(GOOD_HTML, 'MAX_TOKENS');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/MAX_TOKENS/);
  });

  it('rejects other non-STOP finish reasons (e.g. SAFETY)', () => {
    expect(validateDigestHTML(GOOD_HTML, 'SAFETY').valid).toBe(false);
  });

  it('rejects empty / non-string output', () => {
    expect(validateDigestHTML('', 'STOP').valid).toBe(false);
    expect(validateDigestHTML(null, 'STOP').valid).toBe(false);
    expect(validateDigestHTML(undefined).valid).toBe(false);
  });

  it('rejects output below the length floor', () => {
    const short = '<div>KEY INSIGHTS · 1 tweets · 1 sources ·</div>';
    expect(short.length).toBeLessThan(MIN_DIGEST_HTML_LENGTH);
    const res = validateDigestHTML(short, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/too short/);
  });

  it('rejects a long response cut off mid-tag (unclosed + unbalanced divs)', () => {
    expect(LONG_TRUNCATED_HTML.length).toBeGreaterThan(MIN_DIGEST_HTML_LENGTH);
    const res = validateDigestHTML(LONG_TRUNCATED_HTML, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/mid-tag|unbalanced/);
  });

  it('rejects a digest missing the KEY INSIGHTS section', () => {
    const noInsights = GOOD_HTML.replace(/KEY INSIGHTS/g, 'OTHER');
    const res = validateDigestHTML(noInsights, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/KEY INSIGHTS/);
  });

  it('rejects a digest missing the footer (body incomplete)', () => {
    const noFooter = GOOD_HTML.replace(/50 tweets · 17 sources · June 22, 2026/, '');
    const res = validateDigestHTML(noFooter, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/footer/);
  });

  it('rejects the exact 2026-06-23 incident output', () => {
    // finishReason omitted on purpose: even without it, structure alone fails.
    const res = validateDigestHTML(REAL_INCIDENT_HTML);
    expect(res.valid).toBe(false);
  });

  it('rejects a digest with fewer than 3 Key Insights (collapsed/redundant topics)', () => {
    // Simulates the feedback scenario: model emitted only 2 distinct <li>s
    const twoInsights = GOOD_HTML.replace(
      '<li>Insight three connects two facts that matter.</li>',
      ''
    );
    const res = validateDigestHTML(twoInsights, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/3 items/);
  });

  it('rejects a digest with more than 3 Key Insights', () => {
    const fourInsights = GOOD_HTML.replace(
      '<li>Insight three connects two facts that matter.</li>',
      '<li>Insight three connects two facts that matter.</li><li>Insight four is extra.</li>'
    );
    const res = validateDigestHTML(fourInsights, 'STOP');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/3 items/);
  });
});

describe('buildPrompt', () => {
  it('includes a distinct-topic constraint for Key Insights', () => {
    const tweets = [{
      username: 'test', authorName: 'Test User', text: 'test tweet',
      url: 'https://x.com/test/status/1', timestamp: '2026-06-24', metrics: {}
    }];
    const prompt = buildPrompt(tweets, 'June 24, 2026');
    expect(prompt).toMatch(/DISTINCT TOPIC/i);
  });
});
