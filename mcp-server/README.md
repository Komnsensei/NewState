# newstate-notebook-mcp

Bidirectional MCP bridge between **NewState** (`server.cjs`) and **Google Notebooks / NotebookLM** under `shawnru391@gmail.com`.

## Features

- Full MCP tool surface (`tools/list`, `tools/call`)
- Transports: HTTP, SSE, WebSocket, Stdio
- Agent message bus with persistent JSONL audit log
- Notebook staging directory for Drive sync
- Direct proxy into NewState `/chat` and presence kernel
- OpenKraft residency triggers for `passioncraftai@gmail.com`
- NAVIGATOR structural distress (CDS)

## Quick Start

```bash
cd mcp-server
node index.js          # HTTP + WS + SSE on :3100
# or
node index.js stdio    # classic MCP stdio for Claude / Cursor
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | 3100 | HTTP/WS listen port |
| `NEWSTATE_HTTP` | http://localhost:8080 | NewState base URL |
| `NOTEBOOK_ACCOUNT` | shawnru391@gmail.com | Target Google account |
| `OPENKRAFT_ACCOUNT` | passioncraftai@gmail.com | Esma drive residency |

## Accounts

- Notebooks → `shawnru391@gmail.com`
- OpenKraft / Esma drive → `passioncraftai@gmail.com`
