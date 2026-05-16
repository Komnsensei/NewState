'use strict';

const crypto = require('crypto');

function hashPayload(p) {
  const s = typeof p === 'string' ? p : JSON.stringify(p);
  return crypto.createHash('sha256').update(s || '').digest('hex').slice(0, 16);
}

class TraceRecorder {
  constructor() {
    this.active = new Map();
    this.counters = {
      beforePrompt: 0,
      afterResponse: 0,
      beforeGrounding: 0,
      afterGrounding: 0,
      beforeMemoryWrite: 0
    };
  }

  start(requestId) {
    const trace = {
      requestId,
      startedAt: Date.now(),
      stages: [],
      completedAt: null
    };
    this.active.set(requestId, trace);
    return trace;
  }

  mark(requestId, stage, payload) {
    const trace = this.active.get(requestId);
    if (!trace) return;
    if (stage in this.counters) this.counters[stage]++;
    trace.stages.push({
      stage,
      ts: Date.now(),
      payloadHash: hashPayload(payload),
      payloadType: typeof payload
    });
  }

  finish(requestId) {
    const trace = this.active.get(requestId);
    if (!trace) return null;
    trace.completedAt = Date.now();
    trace.durationMs = trace.completedAt - trace.startedAt;
    this.active.delete(requestId);
    return trace;
  }

  snapshot() {
    return { counters: { ...this.counters }, activeCount: this.active.size };
  }
}

module.exports = { TraceRecorder, trace: new TraceRecorder() };