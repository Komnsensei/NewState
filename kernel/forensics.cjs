'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { validate, migrate, channelOf, SCHEMA_VERSION } = require('./schemas/event-schemas.cjs');
const { redactDeep } = require('./redact.cjs');

const { PATHS, ensureAll } = require('./newstate-paths.cjs');
ensureAll();
const FORENSICS_DIR = process.env.OPENKRAFT_FORENSICS_DIR || PATHS.forensics;
const ACTIVE_LOG = path.join(FORENSICS_DIR, 'active.log');
const ARCHIVE_DIR = process.env.OPENKRAFT_FORENSICS_DIR
  ? path.join(FORENSICS_DIR, 'archive')
  : PATHS.forensicsArchive;
const RETENTION = { maxEvents: 50000, maxAgeDays: 30, rotationSizeMB: 50 };

const EVENT_CLASSES = new Set([
  'IDENTITY_ESCALATION','RECURSION_SPIKE','GROUNDING_INTERVENTION','ANCHOR_CORRUPTION',
  'PROMPT_DRIFT','PERSONA_VIOLATION','MEMORY_REPAIR','SHADOW_BYPASS','SHADOW_OBSERVATION'
]);

function ensureDirs() {
  if (!fs.existsSync(FORENSICS_DIR)) fs.mkdirSync(FORENSICS_DIR, { recursive: true });
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

class Forensics {
  constructor() { ensureDirs(); this.eventCount = 0; }

  record(event) {
    let entry = { ts: Date.now(), schemaVersion: SCHEMA_VERSION, type: (event && event.type) || 'UNKNOWN', ...event };
    if (!EVENT_CLASSES.has(entry.type)) {
      entry.schemaViolation = 'unknown-class:' + entry.type;
      entry.originalType = entry.type;
      entry.type = 'UNKNOWN';
      entry.channel = 'unknown';
    } else {
      const check = validate(entry);
      if (!check.ok) {
        entry.schemaViolation = check.reason;
        entry.originalType = entry.type;
        entry.type = 'UNKNOWN';
        entry.channel = 'unknown';
      } else {
        entry.channel = channelOf(entry.type);
      }
    }
    entry = redactDeep(entry);
    fs.appendFileSync(ACTIVE_LOG, JSON.stringify(entry) + '\n');
    this.eventCount++;
    this.maybeRotate();
    return entry;
  }

  query(filters = {}) {
    if (!fs.existsSync(ACTIVE_LOG)) return [];
    const lines = fs.readFileSync(ACTIVE_LOG, 'utf8').split('\n').filter(Boolean);
    let events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map(e => migrate(e));
    if (filters.type)    events = events.filter(e => e.type === filters.type);
    if (filters.channel) events = events.filter(e => e.channel === filters.channel);
    if (filters.since)   events = events.filter(e => e.ts >= filters.since);
    return events;
  }

  maybeRotate() {
    if (!fs.existsSync(ACTIVE_LOG)) return;
    const stat = fs.statSync(ACTIVE_LOG);
    if (stat.size / (1024*1024) >= RETENTION.rotationSizeMB || this.eventCount >= RETENTION.maxEvents) this.rotate();
  }

  rotate() {
    if (!fs.existsSync(ACTIVE_LOG)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(ARCHIVE_DIR, 'forensics-' + stamp + '.log.gz');
    fs.writeFileSync(archivePath, zlib.gzipSync(fs.readFileSync(ACTIVE_LOG)));
    fs.writeFileSync(ACTIVE_LOG, '');
    this.eventCount = 0;
    return archivePath;
  }

  exportBundle() {
    const events = this.query();
    const payload = JSON.stringify(events);
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return { hash, bytes: zlib.gzipSync(payload), count: events.length, exportedAt: Date.now() };
  }

  flush() {}
}

module.exports = { Forensics, forensics: new Forensics(), EVENT_CLASSES };
