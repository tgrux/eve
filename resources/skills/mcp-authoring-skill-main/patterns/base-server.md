# Base Server

A running MCP server with a health check and one example tool. No authentication.

| | |
|---|---|
| **Prereqs** | none |

## Checklist

1. Initialize project
   ```bash
   mkdir my-mcp-server && cd my-mcp-server
   npm init -y
   ```

2. Install dependencies
   ```bash
   npm add @modelcontextprotocol/sdk express zod
   npm add -D typescript @types/node @types/express tsx oxlint oxfmt vitest
   ```
   `jose` is NOT needed yet — only add it when applying an OAuth pattern.

3. If TypeScript: copy config files from this skill's assets
   - `assets/tsconfig.json` → project root
   - `assets/oxlint.json` → project root

4. Create directory structure
   ```
   src/
     server.ts
     http-server.ts
     tools/
       example.ts
   ```

5. Create `src/server.ts`
   ```typescript
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

   export function createServer(): McpServer {
     const server = new McpServer({
       name: "my-mcp-server",
       version: "1.0.0",
     });

     // server.tool("tool_name", "description", { schema }, handler);

     return server;
   }
   ```

6. Create `src/http-server.ts`
   ```typescript
   import express from "express";
   import { randomUUID } from "node:crypto";
   import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
   import { createServer } from "./server.js";

   const app = express();
   app.use(express.json());

   app.use((req, res, next) => {
     const origin = req.headers.origin as string | undefined;
     if (origin) {
       res.header("Access-Control-Allow-Origin", origin);
       res.header("Vary", "Origin");
     }
     res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
     res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
     res.header("Access-Control-Expose-Headers", "mcp-session-id");
     if (req.method === "OPTIONS") { res.sendStatus(204); return; }
     next();
   });

   const sessions = new Map<string, StreamableHTTPServerTransport>();

   app.post("/mcp", async (req, res) => {
     const sessionId = req.headers["mcp-session-id"] as string | undefined;
     let transport: StreamableHTTPServerTransport;

     if (sessionId && sessions.has(sessionId)) {
       transport = sessions.get(sessionId)!;
     } else {
       const id = randomUUID();
       transport = new StreamableHTTPServerTransport({ sessionId: id });
       sessions.set(id, transport);
       const server = createServer();
       await server.connect(transport);
     }

     await transport.handleRequest(req, res, req.body);
   });

   app.get("/mcp", (req, res) => {
     const sessionId = req.headers["mcp-session-id"] as string;
     const transport = sessions.get(sessionId);
     if (!transport) { res.status(400).end(); return; }
     transport.handleRequest(req, res);
   });

   app.delete("/mcp", (req, res) => {
     const sessionId = req.headers["mcp-session-id"] as string;
     sessions.delete(sessionId);
     res.status(200).end();
   });

   app.get("/health", (_req, res) => { res.json({ status: "ok" }); });

   const port = process.env["MCP_PORT"] ?? 3000;
   app.listen(port, () => { console.log(`MCP server listening on port ${port}`); });
   ```

7. Add package.json scripts
   ```json
   {
     "scripts": {
       "dev": "tsx watch --env-file .env src/http-server.ts",
       "build": "tsc",
       "start": "node --env-file .env dist/http-server.js",
       "lint": "oxlint -c oxlint.json",
       "format": "oxfmt --write src",
       "typecheck": "tsc --noEmit",
       "test": "vitest"
     }
   }
   ```

8. Verify: `npm run dev`, then `npx @modelcontextprotocol/inspector` → connect to `http://localhost:3000/mcp` → tools should appear

## Testing

See [@patterns/testing.md](testing.md) for the test harness, boundary guidance, and examples — including tools that call external services.

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_PORT` | No | Server port (default: 3000) |

## What's next?

Ask: **How will clients authenticate?**
- No auth needed → done
- OAuth → [@patterns/implement-oauth.md](implement-oauth.md)
