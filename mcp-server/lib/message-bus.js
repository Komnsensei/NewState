'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const BUS_PATH = path.join(__dirname, '..', '..', 'memory', 'agent-bus.jsonl');

class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.subscribers = new Map();
    this.ensureDir();
  }
  ensureDir() {
    const dir = path.dirname(BUS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  publish(msg) {
    const envelope = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...msg
    };
    this.queue.push(envelope);
    try {
      fs.appendFileSync(BUS_PATH, JSON.stringify(envelope) + '\n');
    } catch (e) {
      console.error('[bus] persist failed', e.message);
    }
    this.emit('message', envelope);
    if (envelope.target) {
      const cb = this.subscribers.get(envelope.target);
      if (cb) cb(envelope);
    }
    for (const [id, cb] of this.subscribers) {
      if (id !== envelope.target) cb(envelope);
    }
    return envelope;
  }
  subscribe(id, callback) {
    this.subscribers.set(id, callback);
    return () => this.subscribers.delete(id);
  }
  recent(n = 50) {
    return this.queue.slice(-n);
  }
  history(limit = 200) {
    try {
      if (!fs.existsSync(BUS_PATH)) return [];
      const lines = fs.readFileSync(BUS_PATH, 'utf8').trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
}

module.exports = new MessageBus();
