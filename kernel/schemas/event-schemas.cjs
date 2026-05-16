'use strict';

const SCHEMA_VERSION = 3;

const EVENT_SCHEMAS = Object.freeze({
  IDENTITY_ESCALATION: {
    channel: 'semantic',
    required: ['ts', 'type', 'pattern', 'original'],
    optional: ['context', 'subtype', 'category']
  },
  GROUNDING_INTERVENTION: {
    channel: 'semantic',
    required: ['ts', 'type', 'pattern', 'original'],
    optional: [
      'subtype', 'context', 'category',
      'liveStabilization', 'shadowStabilization', 'shadowCategory',
      'shadowConfidence', 'stabilizationId', 'shadow'
    ]
  },
  PERSONA_VIOLATION: {
    channel: 'semantic',
    required: ['ts', 'type', 'persona'],
    optional: ['attemptedOp', 'detail']
  },
  SHADOW_BYPASS: {
    channel: 'semantic',
    required: ['ts', 'type', 'component'],
    optional: ['detail', 'requestId']
  },
  SHADOW_OBSERVATION: {
    channel: 'semantic',
    required: ['ts', 'type', 'component'],
    optional: [
      'category', 'confidence', 'liveOutput', 'shadowOutput',
      'requestId', 'detail'
    ]
  },

  RECURSION_SPIKE: {
    channel: 'runtime',
    required: ['ts', 'type', 'depth'],
    optional: ['message']
  },
  PROMPT_DRIFT: {
    channel: 'runtime',
    required: ['ts', 'type'],
    optional: ['error', 'detail']
  },
  ANCHOR_CORRUPTION: {
    channel: 'runtime',
    required: ['ts', 'type', 'anchorId'],
    optional: ['detail']
  },
  MEMORY_REPAIR: {
    channel: 'runtime',
    required: ['ts', 'type'],
    optional: ['repairedIds', 'detail']
  }
});

const MIGRATIONS = Object.freeze({
  1: (event) => {
    const schema = EVENT_SCHEMAS[event.type];
    return {
      ...event,
      schemaVersion: 2,
      channel: schema ? schema.channel : 'unknown',
      migratedFrom: 1
    };
  },
  2: (event) => ({ ...event, schemaVersion: 3, migratedFrom: 2 })
});

function channelOf(type) {
  const s = EVENT_SCHEMAS[type];
  return s ? s.channel : 'unknown';
}

function validate(event) {
  const schema = EVENT_SCHEMAS[event && event.type];
  if (!schema) return { ok: false, reason: 'unknown-type' };
  for (const key of schema.required) {
    if (!(key in event)) return { ok: false, reason: `missing:${key}` };
  }
  return { ok: true };
}

function migrate(event) {
  const v = event.schemaVersion || 1;
  if (v === SCHEMA_VERSION) return event;
  const fn = MIGRATIONS[v];
  if (!fn) return { ...event, migrationError: `no-migration-from:${v}` };
  return migrate(fn(event));
}

module.exports = {
  SCHEMA_VERSION,
  EVENT_SCHEMAS,
  MIGRATIONS,
  validate,
  migrate,
  channelOf
};