import WebSocket from 'ws';
import http from 'http'; // Import the http module
import { IntegrityCritic, EthicalViolationError } from '../kernel/governor/integrity-critic.cjs'; // NEW IMPORT

const NEWSTATE_WS_URL = process.env.NEWSTATE_WS_URL || "ws://localhost:3000";
const MCP_HTTP_PORT = process.env.MCP_PORT || 3100; // Use MCP_PORT for HTTP server
let wsClient = null;

// Instantiate IntegrityCritic for FVI
const mcpIntegrityCritic = new IntegrityCritic();

// Track pending requests and their resolvers for async responses
const pendingWsRequests = new Map();
let nextRequestId = 0;

function connectNewState() {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
    return; // Already connected or connecting
  }

  wsClient = new WebSocket(NEWSTATE_WS_URL);
  console.error("[MCP] Attempting to connect to NewState server.mjs...");

  wsClient.on("open", () => console.error("[MCP] Connected to NewState server.mjs"));
  wsClient.on("error", (err) => console.error("[MCP] NewState connection error:", err.message));
  wsClient.on("close", (code, reason) => {
    console.error(`[MCP] NewState connection closed. Code: ${code}, Reason: ${reason.toString()}. Reconnecting in 5 seconds...`);
    // Reject any pending requests from this disconnected client
    pendingWsRequests.forEach(reject => reject(new Error("WebSocket connection to NewState closed.")));
    pendingWsRequests.clear();
    setTimeout(connectNewState, 5000); // Reconnect after 5 seconds
  });

  wsClient.on("message", (data) => {
    try {
      const response = JSON.parse(data.toString());
      // Assuming NewState sends back a simple ACK for agent messages, or a structured response
      // For now, we'll just resolve the first pending request. A real MCP would have request IDs.
      if (pendingWsRequests.size > 0) {
        const [requestId, resolve] = pendingWsRequests.entries().next().value;
        pendingWsRequests.delete(requestId);
        resolve({
          content: [{ type: "text", text: `Response from NewState: ${JSON.stringify(response)}` }]
        });
      } else {
        console.error("[MCP] Received unsolicited message from NewState:", response);
      }
    } catch (e) {
      console.error("[MCP] Error parsing NewState response:", e);
    }
  });
}

// Initial connection attempt
connectNewState();

// --- MCP-like Stdio Handling ---

async function handleRequest(request) {
  if (request.type === "ListToolsRequest") {
    return {
      type: "ListToolsResponse",
      tools: [
        {
          name: "send_agent_message",
          description: "Sends a message from the notebook/external context to the NewState server.mjs loop.",
          inputSchema: {
            type: "object",
            properties: {
              sender: { type: "string" },
              message: { type: "string" },
              targetNode: { type: "string" }
            },
            required: ["sender", "message"]
          }
        },
        {
          name: "sync_notebook_state",
          description: "Pulls the latest synchronized context from the specified Google account workspace.",
          inputSchema: {
            type: "object",
            properties: {
              account: { type: "string" }
            },
            required: ["account"]
          }
        }
      ]
    };
  } else if (request.type === "CallToolRequest") {
    const { name, arguments: args } = request.params;

    if (name === "send_agent_message") {
      // --- FVI: Formal Verification of Intent (Ethical Check) ---
      try {
        const actionPayload = {
          type: 'agent_message',
          sender: args.sender,
          message: args.message,
          targetNode: args.targetNode,
        };
        mcpIntegrityCritic.evaluateAction(actionPayload);
      } catch (ethicalError) {
        if (ethicalError instanceof EthicalViolationError) {
          console.error("[MCP-FVI] Ethical Violation Detected in send_agent_message:", ethicalError.message);
          console.error("[MCP-FVI] Violations:", JSON.stringify(ethicalError.violations, null, 2));
          throw new Error(`Ethical Violation: Your message violates core Vows. Refused to send. Details: ${ethicalError.message}`);
        } else {
          throw ethicalError; // Re-throw other errors
        }
      }

      if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        console.warn("[MCP] NewState WebSocket not open for send_agent_message. Attempting reconnect.");
        connectNewState(); // Try to reconnect
        await new Promise(resolve => setTimeout(resolve, 200)); // Give it a moment to connect
        if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
          throw new Error("Cannot send message: NewState WebSocket is not connected.");
        }
      }

      const currentRequestId = nextRequestId++;
      return new Promise((resolve, reject) => {
        // Store resolve/reject for when the WebSocket message comes back
        pendingWsRequests.set(currentRequestId, resolve);

        // Set a timeout for the response from NewState
        const timeout = setTimeout(() => {
          pendingWsRequests.delete(currentRequestId); // Clean up
          reject(new Error("Timeout (5s) waiting for response from NewState server for send_agent_message."));
        }, 5000); // 5 second timeout

        // Wrap original resolve to clear timeout
        const originalResolve = resolve;
        pendingWsRequests.set(currentRequestId, (result) => {
          clearTimeout(timeout);
          originalResolve(result);
        });

        wsClient.send(JSON.stringify({ type: "AGENT_MESSAGE", ...args }));
      });
    } else if (name === "sync_notebook_state") {
      // This is a placeholder; actual synchronization logic would go here
      return {
        content: [{ type: "text", text: `State synchronized for account: ${args.account}` }]
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } else {
    throw new Error(`Unknown request type: ${request.type}`);
  }
}

process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  // This is a very basic way to handle stream, assuming each message is a complete line
  // In a real scenario, you'd need a more robust JSON stream parser.
  const lines = buffer.split(String.fromCharCode(10));

  buffer = lines.pop(); // Keep the last incomplete line in buffer

  for (const line of lines) {
    if (line.trim() === '') continue;

    try {
      const request = JSON.parse(line);
      const responsePayload = await handleRequest(request);
      process.stdout.write(JSON.stringify(responsePayload) + String.fromCharCode(10));
    } catch (error) {
      console.error("[MCP-StdIO-Error]", error.message);
      process.stdout.write(JSON.stringify({ type: "ErrorResponse", error: error.message }) + String.fromCharCode(10));
    }
  }
}); // Correct closure for 'data' handler

process.stdin.on('end', () => {
  console.error("[MCP] Stdin stream ended.");
  // Handle any remaining buffer if necessary
});

// --- HTTP Server for NotebookLM Webhook ---
const server = http.createServer(async (req, res) => {
  // Set CORS headers to allow requests from the browser extension
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow requests from any origin (for dev, be more specific in prod)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); // No Content for CORS preflight
    res.end();
    return;
  }

  // Changed to /webhook to match the provided JavaScript snippet
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.error(`[MCP-Webhook] Received data from NotebookLM webhook:`, data);

        // --- FVI: Formal Verification of Intent (Ethical Check) for webhook ---
        try {
          const actionPayload = {
            type: 'webhook_message',
            sender: 'NotebookLM',
            message: JSON.stringify(data),
            targetNode: 'NewState',
          };
          mcpIntegrityCritic.evaluateAction(actionPayload);
        } catch (ethicalError) {
          if (ethicalError instanceof EthicalViolationError) {
            console.error("[MCP-FVI] Ethical Violation Detected in webhook message:", ethicalError.message);
            console.error("[MCP-FVI] Violations:", JSON.stringify(ethicalError.violations, null, 2));
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: `Ethical Violation: Your webhook message violates core Vows. Refused to process. Details: ${ethicalError.message}` }));
            return; // Stop processing if ethical violation
          } else {
            throw ethicalError; // Re-throw other errors
          }
        }

        // Now, we'll just log it and send it to NewState as an agent message.
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({
            type: "AGENT_MESSAGE",
            sender: "NotebookLM",
            message: JSON.stringify(data), // Send the entire data object as a string message
            targetNode: "NewState" // Assuming NewState is the target for now
          }));
          console.error(`[MCP-Webhook] Forwarded data to NewState:`, data);
        } else {
          console.warn("[MCP-Webhook] NewState WebSocket not open, could not forward data.");
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Data received and processed.' }));
      } catch (error) {
        console.error('[MCP-Webhook] Error processing webhook data:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON or processing error.' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(MCP_HTTP_PORT, () => {
  console.error(`[MCP] HTTP server for NotebookLM webhook listening on port ${MCP_HTTP_PORT}`);
});

console.error("[MCP] Stdio MCP server (custom implementation) is running. Waiting for input on stdin.");
`