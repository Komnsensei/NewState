'use strict';
/**
 * Lightweight client for use inside Gemini Notebooks / Colab / local scripts.
 */
const MCP_BASE = process.env.MCP_BASE || 'http://localhost:3100';

async function send(message, opts = {}) {
  const r = await fetch(`${MCP_BASE}/agent/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: opts.sender || 'gemini-notebook',
      message,
      targetNode: opts.targetNode || 'newstate',
      metadata: opts.metadata
    })
  });
  return r.json();
}

async function receive(limit = 20) {
  const r = await fetch(`${MCP_BASE}/agent/messages?limit=${limit}`);
  return r.json();
}

async function inject(message, notebookId) {
  const r = await fetch(`${MCP_BASE}/notebook/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, notebookId, sender: 'gemini-notebook' })
  });
  return r.json();
}

async function sync(account = 'shawnru391@gmail.com') {
  const r = await fetch(`${MCP_BASE}/notebook/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account })
  });
  return r.json();
}

async function chat(text) {
  const r = await fetch(`${MCP_BASE}/mcp/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'chat_with_newstate',
      arguments: { text, sender: 'gemini-notebook' }
    })
  });
  return r.json();
}

function openStream(onMessage) {
  const es = new EventSource(`${MCP_BASE}/mcp/sse`);
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      onMessage(data);
    } catch (_) {}
  };
  return es;
}

module.exports = { send, receive, inject, sync, chat, openStream, MCP_BASE };
