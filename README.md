# 🐦 Twitter AI Intelligence Brief

An autonomous Node.js intelligence agent that transforms the noise of AI Twitter into high-density, executive-level briefings. It monitors global AI leaders, filters for high-signal insights using engagement-weighted scoring, and delivers a beautifully formatted HTML synthesis via Gemini 3 AI.

## ✨ Features

- **Cost-Optimized Datalake:** Powered by TwitterAPI.io with advanced batched searching to keep operating costs <$10/month.
- **Noise-Free Signal:** Automated filters discard retweets, replies, and "thread-spam," focusing only on original impactful content.
- **Multidimensional Synthesis:** Gemini 3 AI categorizes insights into *Tools & Products*, *Industry Trajectory*, and *Research*.
- **Premium Delivery:** Responsive HTML email briefings delivered directly to your inbox via Gmail API.
- **Resilient Architecture:** Multi-model fallback chain (Gemini 3 → 3.1 → 2.5) and dual-API support (TwitterAPI.io + Official X API).

## 🛠️ Architecture

The pipeline follows a strict **Fetch → Parse → Score → Synthesize → Deliver** workflow:

1. **Orchestrator (`index.js`):** Manages the daily execution lifecycle.
2. **Standardized Clients:** Modular drivers for different data sources.
3. **The Scorer:** Engagement-weighted rankings to identify the top 30 most impactful updates.
4. **The Synthesis Engine:** Custom prompt-engineering to prevent "AI laziness" and output structured intelligence.

## 🚀 Getting Started

### 1. Environment Configuration
Create a `.env` file from the example and provide the following keys:
- `TWITTERAPI_IO_KEY`: For cost-optimized data sourcing.
- `GEMINI_API_KEY`: For AI synthesis.
- `RECIPIENT_EMAIL`: Your target briefing destination.

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

---

## ☁️ Deployment

This project is optimized for serverless execution as a **Cloud Run Job** triggered by **Cloud Scheduler**. For detailed infrastructure setup and GCP CLI commands, refer to the internal documentation.

---
*Note: This repository does not include a license and is provided for educational/demonstration purposes.*
