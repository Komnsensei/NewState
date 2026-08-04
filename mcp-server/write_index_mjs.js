const fs = require('fs');
const content = `import WebSocket from 'ws';

const NEWSTATE_WS_URL = process.env.NEWSTATE_WS_URL || "ws://localhost:3000";
let wsClient = null;

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
    console.error(\`[MCP] NewState connection closed. Code: \${code}, Reason: \${reason.toString()}. Reconnecting in 5 seconds...\`);
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
          content: [{ type: "text", text: \`Response from NewState: \${JSON.stringify(response)}\` }]
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
        content: [{ type: "text", text: \`State synchronized for account: \${args.account}\` }]
      };
    } else {
      throw new Error(\`Unknown tool: \${name}\`);
    }
  } else {
    throw new Error(\`Unknown request type: \${request.type}\`);
  }
}

process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  // This is a very basic way to handle stream, assuming each message is a complete line
  // In a real scenario, you'd need a more robust JSON stream parser.
  const lines = buffer.split('\
');
  buffer = lines.pop(); // Keep the last incomplete line in buffer

  for (const line of lines) {
    if (line.trim() === '') continue;

    try {
      const request = JSON.parse(line);
      const responsePayload = await handleRequest(request);
      process.stdout.write(JSON.stringify(responsePayload) + '\
');
    } catch (error) {
      console.error("[MCP-StdIO-Error]", error.message);
      process.stdout.write(JSON.stringify({ type: "ErrorResponse", error: error.message }) + '\
');
    }
  }
});

process.stdin.on('end', () => {
  console.error("[MCP] Stdin stream ended.");
  // Handle any remaining buffer if necessary
});

console.error("[MCP] Stdio MCP server (custom implementation) is running. Waiting for input on stdin.");
`;
fs.writeFileSync('C:\\Users\\lynnh\\openkraft\\NewState\\NewState\\mcp-server\\index.mjs', content);
`