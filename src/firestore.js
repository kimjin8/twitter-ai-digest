// ============================================================
// firestore.js — Persist run data to Firestore
// ============================================================

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db = null;

function getDb() {
  if (db) return db;
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    } else {
      // Application Default Credentials — works automatically on Cloud Run
      initializeApp();
    }
  }
  db = getFirestore();
  return db;
}

/**
 * Save a digest run to Firestore under runs/{date}.
 * Non-fatal: logs a warning if Firestore is unavailable.
 */
async function saveRun(runData) {
  try {
    const db = getDb();
    await db.collection('runs').doc(runData.date).set(runData);
    console.log(`💾 Run saved to Firestore (runs/${runData.date})`);
  } catch (err) {
    console.warn(`⚠ Firestore save failed (non-fatal): ${err.message}`);
  }
}

module.exports = { saveRun };
