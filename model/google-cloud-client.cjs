const { GoogleGenAI } = require("@google/genai");
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
    // Bootstrap ADC from inline JSON env var (Railway-friendly)
    const gcjson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (gcjson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const tmpDir = require("os").tmpdir();
      const tmpFile = require("path").join(tmpDir, "gcp-sa-key.json");
      require("fs").writeFileSync(tmpFile, gcjson, "utf8");
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;
    }
    if (project) {
      this._ai = new GoogleGenAI({ vertexai: true, project, location });
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("google-cloud-client: no GOOGLE_CLOUD_PROJECT and no GEMINI_API_KEY");
      this._ai = new GoogleGenAI({ apiKey });
    }
    'use strict';
// ---------------------------------------------------------------
// model/google-cloud-client.cjs
// Esma brain � Gemini 2.5 Pro via @google/genai SDK
// Lazy init � SDK not instantiated until first invoke()
// ---------------------------------------------------------------

const determinism = require('./determinism-contract.cjs');

const DEFAULT_MODEL   = process.env.GOOGLE_CLOUD_MODEL   || 'gemini-1.5-flash';
const DEFAULT_TIMEOUT = Number(process.env.GOOGLE_CLOUD_TIMEOUT_MS  || 30000);
const DEFAULT_RETRIES = Number(process.env.GOOGLE_CLOUD_MAX_RETRIES || 2);

const PROVIDER_DETERMINISM = Object.freeze({
  providerSupportsSeed: false,
  declaredDeterministic: false,
});

function isRetryable(err) {
  const msg = String(err && err.message || err);
  if (/429|rate.?limit|quota/i.test(msg)) return true;
  if (/5\d\d|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg)) return true;
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class GoogleCloudClient {
  constructor(config = {}) {
    this.config = {
      provider:   'google-cloud',
      model:      config.model     || DEFAULT_MODEL,
      timeoutMs:  config.timeoutMs || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries !== undefined ? config.maxRetries : DEFAULT_RETRIES,
      project:    config.project   || null,
      location:   config.location  || null,
    };
    this.tokens = { in: 0, out: 0 };
    this._ai = null; // lazy � not instantiated until first call
  }

 // -- lazy init � reads env at call time, not load time -------
  _getAI() {
    if (this._ai) return this._ai;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('google-cloud-client: GEMINI_API_KEY not set');
    }

    const { GoogleGenAI } = require('@google/genai');
    this._ai = new GoogleGenAI({ apiKey });
    return this._ai;
  }

  buildContract(overrides = {}) {
    return determinism.build({
      model:                 this.config.model,
      temperature:           overrides.temperature !== undefined ? overrides.temperature : 0,
      topP:                  overrides.topP        !== undefined ? overrides.topP        : 1,
      seed:                  overrides.seed        !== undefined ? overrides.seed        : 0,
      providerSupportsSeed:  PROVIDER_DETERMINISM.providerSupportsSeed,
      declaredDeterministic: PROVIDER_DETERMINISM.declaredDeterministic,
    });
  }

  async invoke(prompt, overrides = {}) {
    const ai       = this._getAI();
    const contract = this.buildContract(overrides);
    const text     = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    let lastErr;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model:    this.config.model,
          contents: text,
          config: {
            temperature: contract.temperature,
            topP:        contract.topP,
          },
        });

        const out = response.text;
        this.tokens.in  += response.usageMetadata?.promptTokenCount     || 0;
        this.tokens.out += response.usageMetadata?.candidatesTokenCount || 0;

        return { text: out, contract };
      } catch (e) {
        lastErr = e;
        if (attempt < this.config.maxRetries && isRetryable(e)) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        break;
      }
    }
    throw new Error('google-cloud-invoke-failed: ' + String(lastErr && lastErr.message || lastErr));
  }
}

const googleCloudClient = new GoogleCloudClient();
module.exports = { GoogleCloudClient, googleCloudClient };
