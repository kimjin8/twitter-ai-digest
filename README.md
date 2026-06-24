# 🐦 Twitter AI Intelligence Brief

An autonomous Node.js intelligence agent that transforms the noise of AI Twitter into high-density, executive-level briefings. It monitors global AI leaders, filters for high-signal insights using engagement-weighted scoring, and delivers a beautifully formatted HTML synthesis via Gemini 3 AI.

## ✨ Features

- **Cost-Optimized Datalake:** Powered by TwitterAPI.io with advanced batched searching to keep operating costs <$10/month.
- **Noise-Free Signal:** Automated filters discard retweets, replies, and "thread-spam," focusing only on original impactful content.
- **Thesis-First Synthesis:** Gemini 3 AI produces a "middle register" briefing — short sentences carrying precise ideas, organized into *Tools & Products*, *Industry Moves*, and *Research Worth Knowing*.
- **Premium Delivery:** Responsive HTML email briefings delivered directly to your inbox via Gmail API.
- **Resilient Architecture:** Multi-model fallback chain (Gemini 3 → 3.1 → 2.5) and dual-API support (TwitterAPI.io + Official X API).
- **Run Persistence:** Every pipeline run is saved to Firestore — including the top 50 ranked tweets, scores, generated HTML, and delivery status — for future ad-hoc analysis.

## 🛠️ Architecture

The pipeline follows a strict **Fetch → Parse → Score → Synthesize → Deliver → Persist** workflow:

1. **Orchestrator (`index.js`):** Manages the daily execution lifecycle.
2. **Standardized Clients:** Modular drivers for different data sources.
3. **The Scorer:** Engagement-weighted rankings to identify the top 50 most impactful updates.
4. **The Synthesis Engine:** Thesis-first prompt design with middle-register language rules and before/after examples to ensure readable, precise output.
5. **Firestore (`src/firestore.js`):** Persists each run to `runs/{YYYY-MM-DD}` for inspection and future AI-assisted evaluation.

## 🚀 Getting Started

### 1. Environment Configuration
Create a `.env` file from the example and provide the following keys:
- `TWITTERAPI_IO_KEY`: For cost-optimized data sourcing.
- `GEMINI_API_KEY`: For AI synthesis.
- `RECIPIENT_EMAIL`: Your target briefing destination.
- `FIREBASE_SERVICE_ACCOUNT_JSON` *(local dev only)*: Paste your Firebase service account JSON as a single-line string. Not needed on Cloud Run — Application Default Credentials are used automatically.

### 2. Authorization & Setup
```bash
npm install
npm run auth       # Authorize Gmail access
npm run dry-run    # Test logic without sending email
```

### 3. Execution
```bash
npm start          # Standard daily run
```

### 4. Prompt Iteration (A/B Testing)
```bash
node ab-test-prompt.js   # Generate & email prompt variants for comparison
```

The prompt controls both content structure and HTML styling. To iterate:
1. Add a new `buildPromptX()` function in `ab-test-prompt.js`
2. Add it to the `variants` array in `main()`
3. Run the script — each variant arrives as a separate email
4. Compare in Gmail, then apply the winner to `src/digest-generator.js`

See the prompt history (versions A-F) documented in `ab-test-prompt.js`.

---

## 🔁 Email-Feedback Autofix

Reply to your daily digest email with feedback (e.g. *"insight 2 misreads the tweet"*) and an automated pipeline opens a fix **pull request** for you to review — running locally on your Claude Max plan ($0, no metered API).

This project is wired into the shared **email-autofix engine** (`~/.email-autofix/`, see its own `README.md`):

- **`email-autofix.config.json`** (repo root) — per-project config: subject matcher, where the email is generated, schedule, and the A/B render hook.
- **`email-autofix/render-sample.js`** + **`sample-tweets.json`** — render a before/after email preview from a fixed sample, attached to the PR so you can open both and see the change.

Daily at 3 AM (retry 5 AM if the Max limit was hit), the engine reads your reply, fixes the root cause with headless Claude Code, runs `npx vitest run`, and opens a PR with a 5-section body (Feedback / Root cause / Changes / Verification / Generalized learning). A run that doesn't complete posts a note to a GitHub *"email-autofix — run log"* issue and retries.

Runtime state and logs live under `~/.email-autofix/` (not in this repo). To install or pause the schedule, see the engine README.

> **Note:** the fix step needs `claude` authenticated to your Max plan, which works from your own shell / the launchd job — not from inside a sandboxed Claude Code Bash tool.

---

## ☁️ Deployment

This project is optimized for serverless execution as a **Cloud Run Job** triggered by **Cloud Scheduler**.

### GCP Infrastructure (one-time setup)

The following resources are required and have been provisioned in the `twitter-ai-digest` GCP project:

**Firestore**
```bash
# Enable API and create database (us-west1, native mode)
gcloud services enable firestore.googleapis.com --project=twitter-ai-digest
gcloud firestore databases create --project=twitter-ai-digest --location=us-west1 --type=firestore-native

# Grant Cloud Run's default service account write access
gcloud projects add-iam-policy-binding twitter-ai-digest \
  --member="serviceAccount:156698762726-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

No additional configuration is needed on Cloud Run — the job uses Application Default Credentials, which automatically inherit the service account's Firestore permissions.

### Viewing Run Data

Each pipeline run is stored in Firestore under `runs/{YYYY-MM-DD}` with the following structure:

| Field | Description |
|-------|-------------|
| `date` | ISO date string (document key) |
| `started_at` / `completed_at` | Run timestamps |
| `stats.filtered_tweet_count` | Tweets after parsing/filtering |
| `stats.top_tweet_count` | Tweets passed to AI (≤50) |
| `top_tweets[]` | Ranked tweet list with scores, metrics, and URLs |
| `synthesis.model_used` | Gemini model that generated the email |
| `synthesis.html` | Full generated email HTML |
| `delivery.sent` | Whether email was actually sent |
| `delivery.message_id` | Gmail message ID |
| `delivery.dry_run` | Whether this was a dry run |

Browse data at: [console.firebase.google.com](https://console.firebase.google.com) → Project `twitter-ai-digest` → Firestore → `runs`

---

*Note: This repository does not include a license and is provided for educational/demonstration purposes.*
