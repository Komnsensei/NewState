'use strict';
const determinism = require('./determinism-contract.cjs');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const DEFAULT_TIMEOUT = Number(process.env.GROQ_TIMEOUT_MS || 30000);
const DEFAULT_RETRIES = Number(process.env.GROQ_MAX_RETRIES || 2);
const PROVIDER_DETERMINISM = Object.freeze({ providerSupportsSeed: true, declaredDeterministic: false });

function isRetryable(err) {
  const msg = String(err && err.message || err);
  if (/429|rate.?limit|quota/i.test(msg)) return true;
  if (/5\d\d|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg)) return true;
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class GroqClient {
  constructor(config = {}) {
    this.config = { provider: 'groq', model: config.model || DEFAULT_MODEL, timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT, maxRetries: config.maxRetries !== undefined ? config.maxRetries : DEFAULT_RETRIES };
    this.tokens = { in: 0, out: 0 };
  }

  _getKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('groq-client: GROQ_API_KEY not set');
    return key;
  }

  buildContract(overrides = {}) {
    return determinism.build({ model: this.config.model, temperature: overrides.temperature !== undefined ? overrides.temperature : 0, topP: overrides.topP !== undefined ? overrides.topP : 1, seed: overrides.seed !== undefined ? overrides.seed : 0, providerSupportsSeed: true, declaredDeterministic: false });
  }

  async invoke(prompt, overrides = {}) {
    const key = this._getKey();
    const contract = this.buildContract(overrides);
    const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const body = {
      model: this.config.model,
      messages: [{ role: 'user', content: text }],
      temperature: contract.temperature,
      top_p: contract.topP
    };
    if (contract.seed !== null && contract.seed !== undefined) body.seed = contract.seed;
    let lastErr;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        let response;
        try {
          response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timer);
        }
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('groq HTTP ' + response.status + ': ' + (json.error && json.error.message || 'unknown error'));
        const out = json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
        this.tokens.in += json.usage ? json.usage.prompt_tokens || 0 : 0;
        this.tokens.out += json.usage ? json.usage.completion_tokens || 0 : 0;
        return { text: out, contract };
      } catch (e) {
        lastErr = e;
        if (attempt < this.config.maxRetries && isRetryable(e)) { await sleep(500 * (attempt + 1)); continue; }
        break;
      }
    }
    throw new Error('groq-invoke-failed: ' + String(lastErr && lastErr.message || lastErr));
  }
}

const groqClient = new GroqClient();
module.exports = { GroqClient, groqClient };
