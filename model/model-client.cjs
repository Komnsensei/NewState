'use strict';

// Guard — fail fast if provider needs a key that is not present
if (process.env.BRAIN_PROVIDER !== 'google-cloud') {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const determinism = require('./determinism-contract.cjs');
const { googleCloudClient } = require('./google-cloud-client.cjs');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
const DEFAULT_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);

const PROVIDER_DETERMINISM = Object.freeze({ providerSupportsSeed: false, declaredDeterministic: false });

function isRetryable(err) {
  const msg = String(err && err.message || err);
  if (/429|rate.?limit|quota/i.test(msg)) return true;
  if (/5\d\d|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg)) return true;
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class ModelClient {
  constructor(config = {}) {
    this.config = { provider: 'gemini', model: config.model || DEFAULT_MODEL, timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS, maxRetries: config.maxRetries !== undefined ? config.maxRetries : DEFAULT_MAX_RETRIES };
    this.tokens = { in: 0, out: 0 };
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.modelHandle = this.client.getGenerativeModel({ model: this.config.model });
  }

  buildContract(overrides = {}) {
    return determinism.build({ model: this.config.model, temperature: overrides.temperature !== undefined ? overrides.temperature : 0, topP: overrides.topP !== undefined ? overrides.topP : 1, seed: overrides.seed !== undefined ? overrides.seed : 0, providerSupportsSeed: PROVIDER_DETERMINISM.providerSupportsSeed, declaredDeterministic: PROVIDER_DETERMINISM.declaredDeterministic });
  }

  async invoke(prompt, overrides = {}) {
    const contract = this.buildContract(overrides);
    const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const generationConfig = { temperature: contract.temperature, topP: contract.topP };
    let lastErr;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.modelHandle.generateContent({ contents: [{ role: 'user', parts: [{ text }] }], generationConfig });
        const out = result.response.text();
        return { text: out, contract };
      } catch (e) {
        lastErr = e;
        if (attempt < this.config.maxRetries && isRetryable(e)) { await sleep(500 * (attempt + 1)); continue; }
        break;
      }
    }
    throw new Error('gemini-invoke-failed: ' + String(lastErr && lastErr.message || lastErr));
  }
}

let _modelClient = null;
function getModelClient() {
  if (_modelClient) return _modelClient;
  if (process.env.BRAIN_PROVIDER === 'google-cloud') {
    _modelClient = googleCloudClient;
  } else {
    _modelClient = new ModelClient();
  }
  return _modelClient;
}

// Lazy wrapper — reads env at first invoke, allows mock override in tests
const modelClient = {
  get config() { return getModelClient().config; },
  get tokens() { return getModelClient().tokens; },
  buildContract(...args) { return getModelClient().buildContract(...args); },
  async invoke(...args) { return getModelClient().invoke(...args); },
};

module.exports = { ModelClient, modelClient, getModelClient };





