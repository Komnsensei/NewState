'use strict';

const HOOK_NAMES = [
  'beforePrompt',
  'afterResponse',
  'beforeGrounding',
  'afterGrounding',
  'beforeMemoryWrite'
];

class HookRegistry {
  constructor() {
    this.registry = new Map();
    for (const name of HOOK_NAMES) this.registry.set(name, []);
  }

  on(name, fn) {
    if (!this.registry.has(name)) throw new Error(`unknown hook: ${name}`);
    if (typeof fn !== 'function') throw new Error('hook must be function');
    this.registry.get(name).push(fn);
    return () => {
      const arr = this.registry.get(name);
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  async run(name, payload) {
    if (!this.registry.has(name)) return payload;
    let value = payload;
    for (const fn of this.registry.get(name)) {
      try {
        const result = await fn(value);
        if (result !== undefined) value = result;
      } catch (err) {
        // Hooks are best-effort. Surface via forensics in caller if needed.
      }
    }
    return value;
  }

  clear(name) {
    if (name) this.registry.set(name, []);
    else for (const n of HOOK_NAMES) this.registry.set(n, []);
  }
}

module.exports = { HookRegistry, hooks: new HookRegistry(), HOOK_NAMES };