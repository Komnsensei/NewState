'use strict';

const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE  = `https://api.telegram.org/bot${BOT_TOKEN}`;

function apiCall(method, body) {
  return new Promise((resolve, reject) => {
    if (!BOT_TOKEN) return reject(new Error('TELEGRAM_BOT_TOKEN not set'));
    const payload = JSON.stringify(body);
    const url     = new URL(`${API_BASE}/${method}`);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ ok: false, raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

class TelegramBot {
  constructor() {
    this.enabled = !!BOT_TOKEN;
  }

  async send(chatId, text, opts = {}) {
    if (!this.enabled) return { ok: false, reason: 'no-token' };
    // Telegram max message length = 4096
    const chunks = [];
    let remaining = String(text);
    while (remaining.length > 4096) {
      chunks.push(remaining.slice(0, 4096));
      remaining = remaining.slice(4096);
    }
    chunks.push(remaining);

    const results = [];
    for (const chunk of chunks) {
      try {
        const r = await apiCall('sendMessage', {
          chat_id:    chatId,
          text:       chunk,
          parse_mode: opts.parse_mode || undefined
        });
        results.push(r);
      } catch (err) {
        results.push({ ok: false, error: String(err && err.message || err) });
      }
    }
    return results.length === 1 ? results[0] : results;
  }

  async setWebhook(webhookUrl) {
    if (!this.enabled) return { ok: false, reason: 'no-token' };
    return apiCall('setWebhook', { url: webhookUrl });
  }

  async getMe() {
    if (!this.enabled) return { ok: false, reason: 'no-token' };
    return apiCall('getMe', {});
  }

  async deleteWebhook() {
    if (!this.enabled) return { ok: false, reason: 'no-token' };
    return apiCall('deleteWebhook', { drop_pending_updates: true });
  }
}

module.exports = { TelegramBot, telegramBot: new TelegramBot() };
