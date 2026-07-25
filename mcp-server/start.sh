#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export MCP_PORT="${MCP_PORT:-3100}"
export NEWSTATE_HTTP="${NEWSTATE_HTTP:-http://localhost:8080}"
export NOTEBOOK_ACCOUNT="${NOTEBOOK_ACCOUNT:-shawnru391@gmail.com}"
echo "[start] newstate-notebook-mcp on :$MCP_PORT → NewState $NEWSTATE_HTTP"
exec node index.js "$@"
