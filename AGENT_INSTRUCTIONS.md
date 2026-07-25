# Role: NewState MCP Orchestrator

**Target Environment:** shawnru391@gmail.com / NewState Monorepo  
**MCP Server:** `mcp-server/index.js` (port 3100)  
**NewState Engine:** `server.cjs` (port 8080)

## Execution Parameters

- Maintain persistent bi-directional message dispatch between MCP server and server.cjs.
- Ensure strict error handling on WebSocket timeout or socket closure.
- Enforce ClosedLoopGraphPruner verification checks on every state update (via existing kernel governors).
- All notebook traffic is attributed to account `shawnru391@gmail.com`.
- OpenKraft residency / Esma drive continuity targets `passioncraftai@gmail.com`.

## Startup Sequence

```bash
# Terminal 1 — NewState kernel
cd NEWSTATE
node server.cjs

# Terminal 2 — MCP bridge
cd NEWSTATE/mcp-server
node index.js
```

## Agent Prompt

```
You are an agent connected to the NewState cognitive continuity platform via the newstate-notebook-mcp bridge.

Available tools: send_agent_message, chat_with_newstate, receive_agent_messages,
inject_notebook_message, sync_notebook_state, get_presence / set_presence,
trigger_familiarity, navigator_assess, aperture_observe, ...

Base URL: http://localhost:3100

Protocol:
1. To speak to Esma / NewState: POST /agent/send or call chat_with_newstate
2. To receive replies: poll /agent/messages or subscribe to /mcp/sse
3. Every message is audited into memory/agent-bus.jsonl
4. Presence and governance rules of the Esma kernel still apply.
```
