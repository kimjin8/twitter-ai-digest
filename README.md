# 🐦 Twitter AI Intelligence Brief

A standalone Node.js application that scrapes top AI thought-leaders, curates high-signal insights using Gemini AI, and delivers a clean, formatted HTML digest via Gmail.

## 🚀 Quick Start (3 Steps)

### 1. Setup X (Twitter) API
1. Create a developer account at [developer.x.com](https://developer.x.com).
2. Create a Project and an App.
3. Enable **Pay-Per-Use** billing (approx. $15/month for 99 accounts daily).
4. Copy your **Bearer Token**.

### 2. Configure Environment
1. Copy `.env.example` to `.env`.
2. Fill in your `X_BEARER_TOKEN`, `GEMINI_API_KEY`, and `RECIPIENT_EMAIL`.
3. Put your `google-credentials.json` (from GCP) in the root folder.

### 3. Run It
```bash
# Install dependencies
npm install

# Authorize Gmail (first time only)
npm run auth

# Test a single run without sending email
npm run dry-run

# Run and send email
npm start
```

## 🛠️ Project Structure

- `index.js`: The "conductor" orchestrating the whole pipeline.
- `src/twitter-client.js`: Official X API v2 communication.
- `src/tweet-parser.js`: Filtering out noise (retweets, replies, short tweets).
- `src/tweet-scorer.js`: Scoring based on engagement, recency, and priority.
- `src/digest-generator.js`: The Gemini 3 AI engine with a 3-model fallback chain.
- `src/email.js`: Beautifully formatted HTML email delivery.

## ☁️ Deploying to Google Cloud (Cloud Run Jobs)

This app is designed to run as a **Cloud Run Job**, triggered daily by **Cloud Scheduler**.

### Build & Push
```bash
gcloud config set project twitter-ai-digest
gcloud auth configure-docker us-west1-docker.pkg.dev
docker build -t us-west1-docker.pkg.dev/twitter-ai-digest/twitter-ai-digest-repo/twitter-ai-digest:latest .
docker push us-west1-docker.pkg.dev/twitter-ai-digest/twitter-ai-digest-repo/twitter-ai-digest:latest
```

### Create Job
```bash
gcloud run jobs create twitter-ai-digest \
  --image=us-west1-docker.pkg.dev/twitter-ai-digest/twitter-ai-digest-repo/twitter-ai-digest:latest \
  --region=us-west1 \
  --memory=512Mi \
  --set-env-vars="GEMINI_API_KEY=...,X_BEARER_TOKEN=...,RECIPIENT_EMAIL=..."
```

### Schedule (8:00 AM UTC Daily)
```bash
gcloud scheduler jobs create http twitter-ai-digest-daily \
  --schedule="0 8 * * *" \
  --uri="[JOB_URL]" \
  --http-method=POST \
  --oauth-service-account-email="[SERVICE_ACCOUNT]"
```

## 🧠 AI Strategy

We avoid "AI laziness" by pre-filtering thousands of tweets down to the **Top 30** highest-signal items before sending them to Gemini. This ensures the prompt remains focused and the analysis stays deep.

- **Primary:** Gemini 3 Flash
- **Fallback 1:** Gemini 3.1 Flash Lite
- **Fallback 2:** Gemini 2.5 Flash

## ⚖️ License
MIT
