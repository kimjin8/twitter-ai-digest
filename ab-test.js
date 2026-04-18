// ============================================================
// ab-test.js — A/B Test: Original vs Curated Account List
// ============================================================
// Usage: node ab-test.js
// Runs the tweet fetch → parse → score pipeline for both lists,
// saves intermediate data, then evaluates both against the
// Digest Quality Framework.
// ============================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { parseTweets } = require("./src/tweet-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Import client directly (bypass config's username list) ──
const { TWITTERAPI_IO_KEY, GEMINI_API_KEY, MIN_FAVES_FILTER, TIMEZONE } = require("./src/config");
const axios = require("axios");

const API_BASE = "https://api.twitterapi.io/twitter";
const MAX_PAGES = 2;
const RATE_LIMIT_RETRY_DELAY = 5000;
const MAX_RETRIES = 2;

// ── Account Lists ──────────────────────────────────────────

const LIST_A_NAME = "Original (100 accounts)";
const LIST_A = [
  "lexfridman","sama","kaifulee","ID_AA_Carmack","AndrewYNg","karpathy",
  "2morrowknight","ylecun","Scobleizer","drfeifei","KirkDBorne","fchollet",
  "rowancheung","antgrasso","demishassabis","Ronald_vanLoon","TamaraMcCleary",
  "geoffreyhinton","goodfellow_ian","jeffdean","erikbryn","timnitgebru",
  "oriolvinyalsml","ceobillionaire","soumithchintala","waitin4agi_","sallyeaves",
  "bernardmarr","fabiomoioli","pascal_bornet","GaryMarcus","thatroblennon",
  "randal_olson","Nicochan33","chrismessina","iainljbrown","HaroldSinnott",
  "DataChaz","mrgreen","NandoDF","clairesilver12","katecrawford",
  "drhassanrashidi","abhi1thakur","yoheinakajima","YuHelenYu","nigewillson",
  "_karenhao","nathanlands","ingliguori","mrogati","oliverchristie",
  "mfordfuture","nathanbenaich","terenceleungsf","alliekmiller","CatherineAdenle",
  "bilawalsidhu","marcusborba","miketamir","grok_","vinod1975","svenphilipsen",
  "bamitav","fogoros","CadeMetz","rodneyabrooks","wellingmax","marktabnet",
  "etzioni","alexjc","genekogan","mjrobbins","localghost","bobgourley",
  "andyjankowski","paulroetzer","SourabhSKatoch","bobviolino","terence_mills",
  "johnchavens","debashis_dutta","davidwkenny","learnopencv","petitegeek",
  "faustospain","wil_bielert","sarahburnett","marek_rosa","sudalairajkumar",
  "hsryueli","Whats_AI","inma_martinez","pandeyajay7","kath0134","ibarkin",
  "rschmelzer","jainkunal","DaphneKoller","mvollmer1"
];

const LIST_B_NAME = "Curated (50 accounts)";
const LIST_B = [
  "simonw","swyx","mattshumer_","_akhaliq","jeremyphoward",
  "hwchase17","jxnlco","chipro","eugeneyan","emollick",
  "bilawalsidhu","DataChaz","yoheinakajima","alexalbert__","rowancheung",
  "sama","nathanbenaich","natolambert","CadeMetz","kaifulee",
  "vinod1975","paulg","garrytan","erikbryn","alliekmiller",
  "jackclark","etzioni","karpathy","ylecun","fchollet",
  "demishassabis","geoffreyhinton","GaryMarcus","drfeifei","AndrewYNg",
  "goodfellow_ian","rodneyabrooks","katecrawford","ID_AA_Carmack","timnitgebru",
  "lexfridman","AnthropicAI","OpenAI","GoogleDeepMind","grok_",
  "paulroetzer","mfordfuture","saranormous","jeffdean","elaborbot"
];

// ── Tweet Fetcher (standalone, not tied to config) ─────────

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
      if ((status === 429 || (status >= 500 && status < 600)) && attempt <= MAX_RETRIES) {
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

async function fetchAllTweets(usernames, sinceDate) {
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < usernames.length; i += batchSize) {
    batches.push(usernames.slice(i, i + batchSize));
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

// ── Scoring (standalone, parameterized by username list) ───

function scoreTweets(parsedTweets, usernameList) {
  if (!Array.isArray(parsedTweets)) return [];
  const now = new Date();
  const maxEngagement = Math.max(1, ...parsedTweets.map((t) => t.engagementTotal || 0));

  const priorityMap = {};
  const totalUsers = usernameList.length;
  usernameList.forEach((u, i) => {
    priorityMap[u.toLowerCase()] = totalUsers - i;
  });

  const W_ENGAGEMENT = 0.5;
  const W_RECENCY = 0.3;
  const W_PRIORITY = 0.2;

  const scored = parsedTweets.map((t) => {
    const engagementScore = t.engagementTotal / maxEngagement;
    const hoursAgo = (now - t.tweetDate) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - hoursAgo / 24);
    const rawPriority = priorityMap[t.username.toLowerCase()] || 0;
    const priorityScore = rawPriority / totalUsers;

    const compositeScore =
      W_ENGAGEMENT * engagementScore +
      W_RECENCY * recencyScore +
      W_PRIORITY * priorityScore;

    return {
      ...t,
      score: Math.round(compositeScore * 1000) / 1000,
      hoursAgo: Math.round(hoursAgo * 10) / 10,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ── Analysis & Metrics ─────────────────────────────────────

function analyzeList(listName, usernames, parsedTweets, scoredTweets) {
  const top50 = scoredTweets.slice(0, 50);

  // Source diversity: unique authors in top 50
  const topAuthors = new Set(top50.map((t) => t.username.toLowerCase()));

  // Which accounts actually produced tweets?
  const activeAccounts = new Set(parsedTweets.map((t) => t.username.toLowerCase()));
  const silentAccounts = usernames.filter((u) => !activeAccounts.has(u.toLowerCase()));

  // Tweet volume by author
  const volumeByAuthor = {};
  parsedTweets.forEach((t) => {
    const u = t.username.toLowerCase();
    volumeByAuthor[u] = (volumeByAuthor[u] || 0) + 1;
  });

  // Top 5 by volume
  const topByVolume = Object.entries(volumeByAuthor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Engagement distribution
  const engagements = parsedTweets.map((t) => t.engagementTotal);
  const avgEngagement = engagements.length > 0
    ? Math.round(engagements.reduce((a, b) => a + b, 0) / engagements.length)
    : 0;
  const medianEngagement = engagements.length > 0
    ? engagements.sort((a, b) => a - b)[Math.floor(engagements.length / 2)]
    : 0;

  // Signal density: tweets with engagement > 50 (rough proxy for "real signal")
  const highSignalTweets = parsedTweets.filter((t) => t.engagementTotal >= 50);

  return {
    listName,
    totalAccounts: usernames.length,
    activeAccounts: activeAccounts.size,
    silentAccounts: silentAccounts.length,
    silentAccountsList: silentAccounts,
    totalTweets: parsedTweets.length,
    tweetsPerActiveAccount: activeAccounts.size > 0
      ? (parsedTweets.length / activeAccounts.size).toFixed(1)
      : 0,
    highSignalTweets: highSignalTweets.length,
    signalDensity: parsedTweets.length > 0
      ? ((highSignalTweets.length / parsedTweets.length) * 100).toFixed(1) + "%"
      : "0%",
    avgEngagement,
    medianEngagement,
    topByVolume,
    top50UniqueAuthors: topAuthors.size,
    top50AuthorList: [...topAuthors],
    top50Tweets: top50.map((t) => ({
      username: t.username,
      text: t.text.substring(0, 120),
      engagement: t.engagementTotal,
      score: t.score,
    })),
  };
}

// ── Gemini Evaluation ──────────────────────────────────────

async function evaluateWithAI(analysisA, analysisB, top50A, top50B) {
  console.log("\n🤖 Running AI evaluation against the Digest Quality Framework...\n");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
  });

  const prompt = `You are evaluating two Twitter account lists for an AI intelligence digest targeting seed-to-Series-A software founders.

## Evaluation Framework (score each 1-10)

1. **Signal Density** — Ratio of actionable, founder-relevant tweets to total volume. Higher = less wasted API calls and AI tokens.
2. **Pillar Balance** — Coverage across: (a) Tools & Products, (b) Industry Intelligence, (c) Research & Discoveries. Penalize lists that are >60% one pillar.
3. **Source Diversity** — How many distinct voices contribute meaningful signal in the top 50? Penalize if 3 or fewer accounts dominate >50% of volume.
4. **Founder Actionability** — Would these tweets change a founder's decisions THIS WEEK? (hiring, vendor choice, build/buy, market timing). Score based on the top 50 tweets content.
5. **Freshness & Exclusivity** — Are these breaking/insider insights, or rehashed mainstream news anyone could find on TechCrunch?
6. **Noise Floor** — Inverse of noise. Penalize: hashtag spam, self-promotion, memes, "woohoo!!!", generic reshares. Score 10 = zero noise, 1 = mostly noise.

---

## List A: ${analysisA.listName}
- Accounts: ${analysisA.totalAccounts} total, ${analysisA.activeAccounts} active, ${analysisA.silentAccounts} silent
- Tweets: ${analysisA.totalTweets} total, ${analysisA.highSignalTweets} high-signal (engagement≥50)
- Signal density: ${analysisA.signalDensity}
- Avg engagement: ${analysisA.avgEngagement}, Median: ${analysisA.medianEngagement}
- Top 50 unique authors: ${analysisA.top50UniqueAuthors}
- Top volume accounts: ${analysisA.topByVolume.map(([u, c]) => `@${u}(${c})`).join(", ")}
- Silent accounts: ${analysisA.silentAccountsList.join(", ")}

### Top 50 tweets (List A):
${top50A.map((t, i) => `${i + 1}. @${t.username} [eng:${t.engagement}] ${t.text}`).join("\n")}

---

## List B: ${analysisB.listName}
- Accounts: ${analysisB.totalAccounts} total, ${analysisB.activeAccounts} active, ${analysisB.silentAccounts} silent
- Tweets: ${analysisB.totalTweets} total, ${analysisB.highSignalTweets} high-signal (engagement≥50)
- Signal density: ${analysisB.signalDensity}
- Avg engagement: ${analysisB.avgEngagement}, Median: ${analysisB.medianEngagement}
- Top 50 unique authors: ${analysisB.top50UniqueAuthors}
- Top volume accounts: ${analysisB.topByVolume.map(([u, c]) => `@${u}(${c})`).join(", ")}
- Silent accounts: ${analysisB.silentAccountsList.join(", ")}

### Top 50 tweets (List B):
${top50B.map((t, i) => `${i + 1}. @${t.username} [eng:${t.engagement}] ${t.text}`).join("\n")}

---

## Output Format (respond in JSON only):

{
  "list_a_scores": {
    "signal_density": <1-10>,
    "pillar_balance": <1-10>,
    "source_diversity": <1-10>,
    "founder_actionability": <1-10>,
    "freshness_exclusivity": <1-10>,
    "noise_floor": <1-10>,
    "total": <sum>,
    "commentary": "<2-3 sentence analysis>"
  },
  "list_b_scores": {
    "signal_density": <1-10>,
    "pillar_balance": <1-10>,
    "source_diversity": <1-10>,
    "founder_actionability": <1-10>,
    "freshness_exclusivity": <1-10>,
    "noise_floor": <1-10>,
    "total": <sum>,
    "commentary": "<2-3 sentence analysis>"
  },
  "winner": "A" or "B",
  "key_differences": "<3-4 bullet points on what drove the difference>",
  "recommended_changes": [
    {"action": "add|remove|keep", "handle": "@username", "reason": "..."},
    ...
  ],
  "suggested_final_list": ["handle1", "handle2", "..."],
  "coverage_gaps": "<any topic areas still underrepresented>"
}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Strip markdown fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trim();

  // Extract JSON object from response
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error("AI response (no JSON found):", text.substring(0, 500));
    throw new Error("AI evaluation did not return valid JSON");
  }
  text = text.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    // Save raw response for debugging
    const debugFile = path.join(__dirname, "ab-test-results", "debug-ai-response.txt");
    fs.writeFileSync(debugFile, text);
    console.error(`JSON parse failed. Raw response saved to ${debugFile}`);
    throw parseErr;
  }
}

// ── Main ───────────────────────────────────────────────────

(async () => {
  const outputDir = path.join(__dirname, "ab-test-results");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  console.log("========================================");
  console.log("🧪 A/B Test: Account List Comparison");
  console.log(`   Date range: since ${last24h}`);
  console.log(`   List A: ${LIST_A.length} accounts (original)`);
  console.log(`   List B: ${LIST_B.length} accounts (curated)`);
  console.log("========================================\n");

  // ── Fetch tweets for both lists in parallel ──
  console.log("📡 Fetching tweets for BOTH lists in parallel...\n");

  console.log(`--- LIST A: ${LIST_A_NAME} ---`);
  const fetchA = fetchAllTweets(LIST_A, last24h);

  // Small stagger to avoid hitting QPS limits with 15+ parallel batches
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`\n--- LIST B: ${LIST_B_NAME} ---`);
  const fetchB = fetchAllTweets(LIST_B, last24h);

  const [tweetsA, tweetsB] = await Promise.all([fetchA, fetchB]);

  console.log(`\n📊 List A: ${tweetsA.length} tweets fetched`);
  console.log(`📊 List B: ${tweetsB.length} tweets fetched`);

  // ── Score ──
  const scoredA = scoreTweets(tweetsA, LIST_A);
  const scoredB = scoreTweets(tweetsB, LIST_B);

  // ── Analyze ──
  const analysisA = analyzeList(LIST_A_NAME, LIST_A, tweetsA, scoredA);
  const analysisB = analyzeList(LIST_B_NAME, LIST_B, tweetsB, scoredB);

  // ── Save raw data ──
  const resultsFile = path.join(outputDir, `ab-test-${timestamp}.json`);
  fs.writeFileSync(
    resultsFile,
    JSON.stringify({ analysisA, analysisB, timestamp, sinceDate: last24h }, null, 2)
  );
  console.log(`\n💾 Raw analysis saved to ${resultsFile}`);

  // ── Print comparison table ──
  console.log("\n========================================");
  console.log("📋 QUANTITATIVE COMPARISON");
  console.log("========================================");
  console.log(`${"Metric".padEnd(30)} ${"List A".padEnd(15)} ${"List B".padEnd(15)}`);
  console.log("-".repeat(60));
  console.log(`${"Total Accounts".padEnd(30)} ${String(analysisA.totalAccounts).padEnd(15)} ${String(analysisB.totalAccounts).padEnd(15)}`);
  console.log(`${"Active (tweeted)".padEnd(30)} ${String(analysisA.activeAccounts).padEnd(15)} ${String(analysisB.activeAccounts).padEnd(15)}`);
  console.log(`${"Silent (0 tweets)".padEnd(30)} ${String(analysisA.silentAccounts).padEnd(15)} ${String(analysisB.silentAccounts).padEnd(15)}`);
  console.log(`${"Active Rate".padEnd(30)} ${((analysisA.activeAccounts/analysisA.totalAccounts)*100).toFixed(0).padEnd(14)}% ${((analysisB.activeAccounts/analysisB.totalAccounts)*100).toFixed(0).padEnd(14)}%`);
  console.log(`${"Total Tweets".padEnd(30)} ${String(analysisA.totalTweets).padEnd(15)} ${String(analysisB.totalTweets).padEnd(15)}`);
  console.log(`${"Tweets/Active Account".padEnd(30)} ${String(analysisA.tweetsPerActiveAccount).padEnd(15)} ${String(analysisB.tweetsPerActiveAccount).padEnd(15)}`);
  console.log(`${"High-Signal Tweets (eng≥50)".padEnd(30)} ${String(analysisA.highSignalTweets).padEnd(15)} ${String(analysisB.highSignalTweets).padEnd(15)}`);
  console.log(`${"Signal Density".padEnd(30)} ${String(analysisA.signalDensity).padEnd(15)} ${String(analysisB.signalDensity).padEnd(15)}`);
  console.log(`${"Avg Engagement".padEnd(30)} ${String(analysisA.avgEngagement).padEnd(15)} ${String(analysisB.avgEngagement).padEnd(15)}`);
  console.log(`${"Median Engagement".padEnd(30)} ${String(analysisA.medianEngagement).padEnd(15)} ${String(analysisB.medianEngagement).padEnd(15)}`);
  console.log(`${"Top 50: Unique Authors".padEnd(30)} ${String(analysisA.top50UniqueAuthors).padEnd(15)} ${String(analysisB.top50UniqueAuthors).padEnd(15)}`);

  console.log("\n📢 Top 10 by Volume (List A):");
  analysisA.topByVolume.forEach(([u, c]) => console.log(`   @${u}: ${c} tweets`));
  console.log("\n📢 Top 10 by Volume (List B):");
  analysisB.topByVolume.forEach(([u, c]) => console.log(`   @${u}: ${c} tweets`));

  console.log("\n😴 Silent Accounts (List A):");
  console.log(`   ${analysisA.silentAccountsList.join(", ")}`);
  console.log("\n😴 Silent Accounts (List B):");
  console.log(`   ${analysisB.silentAccountsList.join(", ")}`);

  // ── AI Evaluation ──
  const top50A = analysisA.top50Tweets;
  const top50B = analysisB.top50Tweets;

  const evaluation = await evaluateWithAI(analysisA, analysisB, top50A, top50B);

  // Save evaluation
  const evalFile = path.join(outputDir, `ab-evaluation-${timestamp}.json`);
  fs.writeFileSync(evalFile, JSON.stringify(evaluation, null, 2));
  console.log(`\n💾 AI evaluation saved to ${evalFile}`);

  // Print evaluation
  console.log("\n========================================");
  console.log("🤖 AI EVALUATION (Digest Quality Framework)");
  console.log("========================================");

  const dims = ["signal_density", "pillar_balance", "source_diversity", "founder_actionability", "freshness_exclusivity", "noise_floor"];
  const dimLabels = ["Signal Density", "Pillar Balance", "Source Diversity", "Founder Actionability", "Freshness/Exclusivity", "Noise Floor"];

  console.log(`\n${"Dimension".padEnd(25)} ${"List A".padEnd(10)} ${"List B".padEnd(10)}`);
  console.log("-".repeat(45));
  dims.forEach((d, i) => {
    const a = evaluation.list_a_scores[d];
    const b = evaluation.list_b_scores[d];
    const marker = a > b ? " ◀" : b > a ? "      ◀" : "";
    console.log(`${dimLabels[i].padEnd(25)} ${String(a + "/10").padEnd(10)} ${String(b + "/10").padEnd(10)}${marker}`);
  });
  console.log("-".repeat(45));
  console.log(`${"TOTAL".padEnd(25)} ${String(evaluation.list_a_scores.total + "/60").padEnd(10)} ${String(evaluation.list_b_scores.total + "/60").padEnd(10)}`);

  console.log(`\n🏆 Winner: List ${evaluation.winner}`);

  console.log("\n📝 List A Commentary:");
  console.log(`   ${evaluation.list_a_scores.commentary}`);
  console.log("\n📝 List B Commentary:");
  console.log(`   ${evaluation.list_b_scores.commentary}`);

  console.log("\n🔑 Key Differences:");
  console.log(`   ${evaluation.key_differences}`);

  if (evaluation.recommended_changes && evaluation.recommended_changes.length > 0) {
    console.log("\n📋 Recommended Changes:");
    evaluation.recommended_changes.forEach((c) => {
      console.log(`   ${c.action.toUpperCase()}: @${c.handle} — ${c.reason}`);
    });
  }

  if (evaluation.suggested_final_list) {
    console.log(`\n✅ Suggested Final List (${evaluation.suggested_final_list.length} accounts):`);
    console.log(`   ${evaluation.suggested_final_list.join(", ")}`);
  }

  if (evaluation.coverage_gaps) {
    console.log("\n⚠ Coverage Gaps:");
    console.log(`   ${evaluation.coverage_gaps}`);
  }

  console.log("\n========================================");
  console.log("✅ A/B Test Complete!");
  console.log("========================================\n");
})().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
