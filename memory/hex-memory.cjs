'use strict';

const { runtime } = require('../kernel/runtime-state.cjs');

class HexMemory {
  constructor() {
    this.records = [];
  }

  retrieve(_query) {
    if (!runtime.flags.memoryEnabled) {
      return { facts: [], packet: '' };
    }
    // Real retrieval is gated until Phase 6M.
    return { facts: [], packet: '' };
  }

  store(_fact) {
    if (!runtime.flags.memoryEnabled) {
      return { ok: false, reason: 'memory-disabled' };
    }
    return { ok: false, reason: 'phase-6m-not-active' };
  }
}

module.exports = { HexMemory, hexMemory: new HexMemory() };