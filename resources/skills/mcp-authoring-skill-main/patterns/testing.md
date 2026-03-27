# Testing

Automated tests for MCP servers.

| | |
|---|---|
| **Prereqs** | [@patterns/base-server.md](base-server.md) |

## The boundary

Test through the MCP protocol, not through HTTP. Every MCP SDK provides an in-memory transport — a linked pair that connects a client and server in-process, no network involved. Use it.

You're testing what your server does when a client calls a tool, lists resources, etc. You're not testing HTTP routing, SSE framing, or session headers — that's the SDK's job.

**Test**: tool registration, tool input validation, tool output, business logic, error responses.

**Don't test**: HTTP serialization, SSE streaming, CORS headers, session management.

## Test harness

Write a helper that creates a connected client/server pair using the SDK's in-memory transport. Each test gets a fresh pair — no shared state between tests. The helper calls `createServer()` (from your server module), wires both ends of the transport, and returns the connected client.

This is a real server with a real client. No mocks at this layer.

## What to test

### Tool registration

List tools through the client. Assert the names you expect are present. This catches registration mistakes — misspelled names, tools that didn't get wired up.

### Tool input/output

Call a tool through the client with valid arguments. Assert the response content. Then call it with invalid arguments and assert it rejects — the SDK validates input against your schema before the handler runs, so this confirms your schema is correct.

### Tools that call external services

Don't mock the MCP layer — mock the dependency the tool calls.

Structure tools so their external dependencies (API clients, database connections, etc.) are injectable. In production, pass the real client. In tests, pass a fake. The MCP client/server pair stays real; the only fake is the thing behind your tool.

Test both the happy path (dependency returns data → tool returns content) and the failure path (dependency throws → tool returns an error response).

