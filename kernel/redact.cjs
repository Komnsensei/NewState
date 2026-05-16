'use strict';

const SECRET_ENV_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENKRAFT_ADMIN_TOKEN'
];

function buildPatterns() {
  const values = [];
  for (const k of SECRET_ENV_KEYS) {
    const v = process.env[k];
    if (v && v.length >= 8) values.push(v);
  }
  return values;
}

function redactString(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const v of buildPatterns()) {
    if (out.includes(v)) {
      out = out.split(v).join('[REDACTED-SECRET]');
    }
  }
  out = out.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[REDACTED-GOOGLE-KEY]');
  out = out.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED-OPENAI-KEY]');
  return out;
}

function redactDeep(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = redactDeep(value[k]);
    return out;
  }
  return value;
}

module.exports = { redactString, redactDeep, SECRET_ENV_KEYS };