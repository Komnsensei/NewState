import { WebSocketServer } from 'ws';
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`NewState MCP Bridge Active
`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[NewState Server] MCP Agent connected.');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log(`[Autonomy Loop] Received payload from ${parsed.sender}:`, parsed.message);

      // Route message through ESMA subjectivity layer or active cron dispatcher
      // This is where the core logic of NewState would process the agent message
      ws.send(JSON.stringify({ status: 'ACK', processedAt: new Date().toISOString() }));
    } catch (e) {
      console.error('[Error] Invalid JSON payload received:', e);
      ws.send(JSON.stringify({ status: 'ERROR', error: e.message, processedAt: new Date().toISOString() }));
    }
  });

  ws.on('close', () => {
    console.log('[NewState Server] MCP Agent disconnected.');
  });

  ws.on('error', (error) => {
    console.error('[NewState Server] WebSocket error:', error);
  });
});

server.listen(3000, () => {
  console.log('[NewState] server.mjs listening on port 3000');
});