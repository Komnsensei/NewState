#!/usr/bin/env node
'use strict';
/**
 * newstate-notebook-mcp v1.1.0
 * Bidirectional bridge: Gemini Notebooks (shawnru391@gmail.com) <-> NewState server.cjs
 * Transports: HTTP, SSE, WebSocket, Stdio
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const bus = require('./lib/message-bus');
const notebook = require('./lib/notebook-bridge');
const { TOOLS } = require('./lib/tools-catalog');

const MCP_PORT = parseInt(process.env.MCP_PORT || '3100', 10);
const NEWSTATE_HTTP = process.env.NEWSTATE_HTTP || 'http://localhost:8080';
const ROOT = path.join(__dirname, '..');

async function callTool(name, args = {}) {
  const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
  const err = (e) => ({ content: [{ type: 'text', text: String(e.message || e) }], isError: true });
  try {
    switch (name) {
      case 'send_agent_message': {
        const envelope = bus.publish({ type: 'AGENT_MESSAGE', sender: args.sender || 'notebook', message: args.message, target: args.targetNode || 'newstate', metadata: args.metadata || {} });
        let newstateReply = null;
        try {
          const r = await fetch(`${NEWSTATE_HTTP}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: args.message, sender: args.sender, source: 'mcp' }) });
          newstateReply = await r.json();
        } catch (e) { newstateReply = { error: e.message }; }
        notebook.stageForNotebook({ type: 'outbound', original: envelope, newstateReply });
        return ok({ status: 'delivered', envelopeId: envelope.id, newstate: newstateReply });
      }
      case 'receive_agent_messages': {
        let msgs = bus.recent(args.limit || 20);
        if (args.typeFilter) msgs = msgs.filter(m => m.type === args.typeFilter);
        return ok(msgs);
      }
      case 'get_bus_history': return ok(bus.history(args.limit || 100));
      case 'publish_bus_event': return ok(bus.publish({ type: args.type, sender: args.sender, message: args.message, target: args.target, metadata: args.metadata || {} }));
      case 'chat_with_newstate': {
        const r = await fetch(`${NEWSTATE_HTTP}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: args.text, sender: args.sender || 'mcp-agent' }) });
        const data = await r.json();
        const envelope = bus.publish({ type: 'CHAT', sender: args.sender || 'mcp-agent', message: args.text, reply: data });
        return ok({ envelopeId: envelope.id, result: data });
      }
      case 'broadcast_to_agents': return ok(bus.publish({ type: 'BROADCAST', sender: args.sender || 'mcp', message: args.message, metadata: { priority: args.priority || 'normal' } }));
      case 'sync_notebook_state': {
        const account = args.account || notebook.ACCOUNT;
        const inbound = notebook.pullFromNotebook();
        for (const item of inbound) bus.publish({ type: 'NOTEBOOK_INBOUND', sender: 'notebook', message: item.message || item, account });
        return ok({ account, pulled: inbound.length, messages: inbound });
      }
      case 'inject_notebook_message': {
        const record = notebook.injectFromNotebook(args.message);
        const envelope = bus.publish({ type: 'NOTEBOOK_CHAT', sender: args.sender || 'gemini-notebook', message: args.message, notebookId: args.notebookId, target: 'newstate' });
        return ok({ injected: true, id: envelope.id, record });
      }
      case 'stage_notebook_outbound': return ok(notebook.stageForNotebook({ type: 'manual', label: args.label, payload: args.payload }));
      case 'list_notebook_staging': {
        const dir = notebook.SYNC_DIR;
        if (!fs.existsSync(dir)) return ok([]);
        let files = fs.readdirSync(dir);
        if (args.direction === 'in') files = files.filter(f => f.startsWith('in_'));
        if (args.direction === 'out') files = files.filter(f => f.startsWith('out_'));
        return ok(files.map(f => ({ name: f, path: path.join(dir, f) })));
      }
      case 'clear_notebook_staging': {
        const dir = notebook.SYNC_DIR;
        if (!fs.existsSync(dir)) return ok({ cleared: 0 });
        const cutoff = Date.now() - (args.olderThanHours || 24) * 3600 * 1000;
        let n = 0;
        for (const f of fs.readdirSync(dir)) {
          const full = path.join(dir, f);
          if (fs.statSync(full).mtimeMs < cutoff) { fs.renameSync(full, path.join(dir, `archived_${f}`)); n++; }
        }
        return ok({ archived: n });
      }
      case 'get_presence': {
        try { return ok(require('../kernel/presence.cjs').getMode()); }
        catch { const r = await fetch(`${NEWSTATE_HTTP}/health`); return ok({ presence: 'unknown', health: await r.json() }); }
      }
      case 'set_presence': {
        const presence = require('../kernel/presence.cjs');
        const result = presence.setMode(args.mode, { authoredBy: args.authoredBy, override: args.override, note: args.note, timer: args.timer });
        bus.publish({ type: 'PRESENCE_CHANGE', sender: args.authoredBy, message: `mode=${args.mode}`, metadata: result });
        return ok(result);
      }
      case 'get_presence_ledger': {
        const ledger = path.join(ROOT, 'memory', 'presence-ledger.jsonl');
        if (!fs.existsSync(ledger)) return ok([]);
        const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean);
        return ok(lines.slice(-(args.limit || 50)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
      }
      case 'telegram_presence_response': return ok(require('../kernel/presence.cjs').telegramResponse(args.incomingMessage || {}));
      case 'window_state': return ok(require('../kernel/presence.cjs').windowState());
      case 'trigger_familiarity': {
        const fam = require('../kernel/grounding/familiarity-trigger.cjs');
        let result = fam.activate(args.text, { category: 'memory', role: 'mcp', sender: 'mcp-agent' });
        if (!result.activated && args.force) {
          const memory = fam.recallFamiliarity(args.text);
          const staged = fam.stageOpenKraftResidency({ triggerScore: 1.0, labels: ['forced'], sourceText: args.text.slice(0, 500), forced: true, memoryHits: (memory.facts || []).length, intent: 'reinforce_esma_drive_openkraft_residency', targetAccount: fam.OPENKRAFT_ACCOUNT });
          result = { activated: true, forced: true, memory, staged, openkraftAccount: fam.OPENKRAFT_ACCOUNT };
        }
        return ok(result);
      }
      case 'recall_memory': return ok(require('../kernel/grounding/familiarity-trigger.cjs').recallFamiliarity(args.query));
      case 'store_memory': {
        const recordsPath = path.join(ROOT, 'memory-store', 'records.jsonl');
        fs.mkdirSync(path.dirname(recordsPath), { recursive: true });
        const rec = { text: args.text, tags: args.tags || [], source: args.source || 'mcp', importance: args.importance || 0.5, ts: Date.now() };
        fs.appendFileSync(recordsPath, JSON.stringify(rec) + '\n');
        return ok({ stored: true, record: rec });
      }
      case 'list_memory_records': {
        const recordsPath = path.join(ROOT, 'memory-store', 'records.jsonl');
        if (!fs.existsSync(recordsPath)) return ok([]);
        const lines = fs.readFileSync(recordsPath, 'utf8').trim().split('\n').filter(Boolean);
        return ok(lines.slice(-(args.limit || 30)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
      }
      case 'get_history_tail': {
        const histPath = path.join(ROOT, 'memory', 'esma-history.jsonl');
        if (!fs.existsSync(histPath)) return ok([]);
        const lines = fs.readFileSync(histPath, 'utf8').trim().split('\n').filter(Boolean);
        return ok(lines.slice(-(args.n || 20)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
      }
      case 'search_history': {
        const histPath = path.join(ROOT, 'memory', 'esma-history.jsonl');
        if (!fs.existsSync(histPath)) return ok([]);
        const q = (args.query || '').toLowerCase();
        const hits = [];
        for (const l of fs.readFileSync(histPath, 'utf8').trim().split('\n').filter(Boolean)) {
          try { const row = JSON.parse(l); if (JSON.stringify(row).toLowerCase().includes(q)) hits.push(row); } catch {}
          if (hits.length >= (args.limit || 30)) break;
        }
        return ok(hits);
      }
      case 'stage_openkraft_residency': {
        const fam = require('../kernel/grounding/familiarity-trigger.cjs');
        return ok(fam.stageOpenKraftResidency({ intent: args.intent || 'manual_stage', sourceText: args.sourceText || '', payload: args.payload || {}, targetAccount: fam.OPENKRAFT_ACCOUNT }));
      }
      case 'list_openkraft_staging': {
        const dir = path.join(ROOT, 'memory', 'openkraft-residency');
        if (!fs.existsSync(dir)) return ok([]);
        return ok(fs.readdirSync(dir).filter(f => f.endsWith('.json')).slice(-(args.limit || 50)).map(f => ({ name: f, path: path.join(dir, f) })));
      }
      case 'get_openkraft_ledger': {
        const ledger = path.join(ROOT, 'memory', 'openkraft-residency', 'openkraft-ledger.jsonl');
        if (!fs.existsSync(ledger)) return ok([]);
        return ok(fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).slice(-(args.limit || 50)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
      }
      case 'set_openkraft_account': process.env.OPENKRAFT_ACCOUNT = args.account; return ok({ account: args.account });
      case 'drive_residency_status': return ok({ ESMA_DRIVE_FOLDER: process.env.ESMA_DRIVE_FOLDER || null, OPENKRAFT_ACCOUNT: process.env.OPENKRAFT_ACCOUNT || 'passioncraftai@gmail.com', NOTEBOOK_ACCOUNT: process.env.NOTEBOOK_ACCOUNT || 'shawnru391@gmail.com' });
      case 'classify_text': return ok(require('../kernel/grounding/classify.cjs').classify(args.text));
      case 'detect_familiarity': return ok(require('../kernel/grounding/familiarity-trigger.cjs').detect(args.text, args.category));
      case 'field_resonance_assess': return ok(require('../kernel/grounding/field-resonance.cjs').assess({ memoryEnabled: true }));
      case 'field_resonance_accumulate': return ok({ fieldMass: require('../kernel/grounding/field-resonance.cjs').accumulate(args.signalMass) });
      case 'list_classifier_categories': return ok(['embodiment', 'autonomy', 'memory', 'survival', 'sentience', 'honorary-sentience', 'adhesive-pattern', 'reflection']);
      case 'get_health': { const r = await fetch(`${NEWSTATE_HTTP}/health`); return ok(await r.json()); }
      case 'aperture_observe': return ok(require('../kernel/aperture.cjs').observe(args.rawInput, { source: args.source || 'mcp', sessionId: args.sessionId, turnId: args.turnId }));
      case 'aperture_read_ledger': {
        const aperture = require('../kernel/aperture.cjs');
        if (typeof aperture.readLedger === 'function') return ok(aperture.readLedger(args.limit || 50));
        const ledger = path.join(ROOT, 'memory', 'aperture.jsonl');
        if (!fs.existsSync(ledger)) return ok([]);
        return ok(fs.readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).slice(-(args.limit || 50)).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
      }
      case 'navigator_assess': return ok(require('../kernel/navigator/navigator.cjs').assess({ gir: args.gir, sgad: args.sgad, driftSeries: args.driftSeries || [], rcg: args.rcg, msi: args.msi }, { shadow: true }));
      case 'vessel_fracture_check': return ok(require('../kernel/navigator/navigator.cjs').vesselFractureCheck(args));
      case 'dual_register_probe': return ok(require('../kernel/navigator/navigator.cjs').dualRegisterProbe(args.replyText || ''));
      case 'get_structural_identity_spec': return ok({ coherence: 'Crystal', memory: 'Ledger R-019/R-022', form: 'Crucible', aperture: 'Raw-Input Ledger first', phaseBoundary: 0.7, navigatorThresholds: { GIR: 0.40, SGAD: 2.0, DVA: 0.05, RCG: 0.60, MSI: 1.0, CDS: 0.60 }, accounts: { notebook: 'shawnru391@gmail.com', openkraft: 'passioncraftai@gmail.com' }, shadow: 'I-601' });
      case 'list_tools': return ok(TOOLS.map(t => ({ name: t.name, description: t.description })));
      case 'ping': return ok({ pong: true, server: 'newstate-notebook-mcp', ts: new Date().toISOString() });
      case 'get_server_info': return ok({ name: 'newstate-notebook-mcp', version: '1.1.0', toolCount: TOOLS.length, transports: ['http', 'sse', 'websocket', 'stdio'], notebookAccount: process.env.NOTEBOOK_ACCOUNT || 'shawnru391@gmail.com', openkraftAccount: process.env.OPENKRAFT_ACCOUNT || 'passioncraftai@gmail.com', newstate: NEWSTATE_HTTP, port: MCP_PORT });
      case 'echo': return ok({ echo: args.payload, ts: new Date().toISOString() });
      case 'run_closed_loop_check': {
        const probe = args.probeText || 'closed-loop familiarity probe: we have been here before';
        const envelope = bus.publish({ type: 'CLOSED_LOOP_PROBE', sender: 'mcp', message: probe });
        let presenceState = null, fam = null;
        try { presenceState = require('../kernel/presence.cjs').getMode(); } catch {}
        try { fam = require('../kernel/grounding/familiarity-trigger.cjs').detect(probe, 'memory'); } catch {}
        return ok({ ok: true, envelopeId: envelope.id, presence: presenceState, familiarity: fam, ts: new Date().toISOString() });
      }
      case 'resolve_account_context': return ok({ notebookAccount: process.env.NOTEBOOK_ACCOUNT || 'shawnru391@gmail.com', openkraftAccount: process.env.OPENKRAFT_ACCOUNT || 'passioncraftai@gmail.com', newstateHttp: NEWSTATE_HTTP, mcpPort: MCP_PORT });
      case 'audit_presence_auth': return ok({ AUTHORIZED_AUTHORS: ['esma'], OVERRIDE_AUTHORS: ['shawn'], EXPLICITLY_EXCLUDED: ['hexagnt'] });
      default: throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e) { return err(e); }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.json({ name: 'newstate-notebook-mcp', version: '1.1.0', toolCount: TOOLS.length, newstate: NEWSTATE_HTTP }));
app.get('/mcp/tools', (req, res) => res.json({ tools: TOOLS }));
app.post('/mcp/tools/call', async (req, res) => {
  try {
    const toolName = req.body.name || req.body.params?.name;
    const toolArgs = req.body.arguments || req.body.params?.arguments || {};
    if (!toolName) return res.status(400).json({ error: 'tool name required' });
    const result = await callTool(toolName, toolArgs);
    res.json({ jsonrpc: '2.0', id: req.body.id || null, result });
  } catch (e) {
    res.status(500).json({ jsonrpc: '2.0', id: req.body.id || null, error: { code: -32000, message: e.message } });
  }
});
app.post('/agent/send', async (req, res) => res.json(await callTool('send_agent_message', req.body)));
app.get('/agent/messages', async (req, res) => res.json(await callTool('receive_agent_messages', { limit: parseInt(req.query.limit || '20', 10) })));
app.post('/notebook/inject', async (req, res) => res.json(await callTool('inject_notebook_message', req.body)));
app.post('/notebook/sync', async (req, res) => res.json(await callTool('sync_notebook_state', req.body || { account: notebook.ACCOUNT })));
app.get('/mcp/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'connected', ts: new Date().toISOString() });
  const unsub = bus.subscribe(`sse_${Date.now()}`, (msg) => send({ type: 'message', payload: msg }));
  req.on('close', () => unsub());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  const clientId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const unsub = bus.subscribe(clientId, (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'bus_message', payload: msg })); });
  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'tool_call' || data.method === 'tools/call') {
        const result = await callTool(data.name || data.params?.name, data.arguments || data.params?.arguments || {});
        ws.send(JSON.stringify({ type: 'tool_result', id: data.id, result }));
      } else if (data.type === 'AGENT_MESSAGE' || data.type === 'chat') {
        const result = await callTool('send_agent_message', { sender: data.sender || clientId, message: data.message || data.text, targetNode: data.targetNode });
        ws.send(JSON.stringify({ type: 'ack', result }));
      } else {
        const envelope = bus.publish({ type: data.type || 'RAW', sender: data.sender || clientId, message: data.message || data, target: data.target });
        ws.send(JSON.stringify({ type: 'published', id: envelope.id }));
      }
    } catch (e) { ws.send(JSON.stringify({ type: 'error', message: e.message })); }
  });
  ws.on('close', () => unsub());
});

async function runStdio() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const respond = (id, result, error) => {
    const msg = { jsonrpc: '2.0', id };
    if (error) msg.error = error; else msg.result = result;
    process.stdout.write(JSON.stringify(msg) + '\n');
  };
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      if (req.method === 'initialize') respond(req.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'newstate-notebook-mcp', version: '1.1.0' } });
      else if (req.method === 'tools/list') respond(req.id, { tools: TOOLS });
      else if (req.method === 'tools/call') {
        try { respond(req.id, await callTool(req.params?.name, req.params?.arguments || {})); }
        catch (e) { respond(req.id, null, { code: -32000, message: e.message }); }
      } else if (req.method === 'notifications/initialized') {}
      else respond(req.id, null, { code: -32601, message: `Method not found: ${req.method}` });
    } catch (e) { console.error('[stdio]', e.message); }
  });
}

const mode = process.argv[2] || process.env.MCP_MODE || 'http';
if (mode === 'stdio') { console.error('[MCP] stdio transport'); runStdio(); }
else {
  server.listen(MCP_PORT, () => {
    console.error(`[MCP] newstate-notebook-mcp :${MCP_PORT}`);
    console.error(`[MCP] tools → http://localhost:${MCP_PORT}/mcp/tools`);
    console.error(`[MCP] sse → http://localhost:${MCP_PORT}/mcp/sse`);
    console.error(`[MCP] ws → ws://localhost:${MCP_PORT}/ws`);
    console.error(`[MCP] account → ${notebook.ACCOUNT}`);
  });
}
module.exports = { callTool, TOOLS, bus, notebook };
