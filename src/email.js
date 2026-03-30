// ============================================================
// email.js — Send Emails via Gmail API
// ============================================================

const { google } = require('googleapis');
const { RECIPIENT_EMAIL } = require('./config');

async function sendEmail(authClient, htmlBody) {
  console.log(`📧 Sending email to ${RECIPIENT_EMAIL}...`);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // Use yesterday's UTC date — the day whose tweets this digest covers
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = `${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}/${String(yesterday.getUTCDate()).padStart(2, '0')}/${String(yesterday.getUTCFullYear()).slice(-2)}`;
  const subject = `🐦 Your Twitter AI Intelligence Digest - ${dateStr}`;
  
  const messageParts = [
    `To: ${RECIPIENT_EMAIL}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
  ];

  const rawMessage = messageParts.join('\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log('✅ Email sent! Message ID:', res.data.id);
    return { ...res.data, subject };
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    throw err;
  }
}

module.exports = { sendEmail };
