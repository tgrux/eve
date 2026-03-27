# OAuth Proxy

Proxy OAuth endpoints through the MCP server so browser-based clients can complete the OAuth flow without CORS blocking requests to your auth server.

| | |
|---|---|
| **Prereqs** | [@patterns/implement-oauth.md](implement-oauth.md) |
| **Constraints** | Keycloak CORS cannot be configured to allow MCP client origins |

## When to use

Your MCP server supports clients that run in a browser environment. Today that means:
- **Claude Desktop** (Electron — Chromium under the hood)
- **MCP Inspector** (web app)
- Any future browser-based MCP client

If your only consumers are **Claude Code** (Node.js CLI) or **backend services** (CI, server-to-server), skip this pattern. Point `authorization_servers` in your Protected Resource Metadata directly at Keycloak.

## The problem

Browser runtimes enforce CORS. Keycloak doesn't set CORS headers for your MCP client's origin. The client can't reach Keycloak's token, registration, or JWKS endpoints. The OAuth flow fails silently — clients like Claude Desktop show a vague connection error.

## The solution

Proxy the OAuth endpoints through your MCP server. Clients talk to your server (same origin, no CORS issue), your server forwards to Keycloak (server-to-server, no CORS).

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  MCP Client │ ──────> │  MCP Server │ ──────> │ Auth Server  │
│  (browser)  │  OAuth  │   (proxy)   │  proxy  │ (Keycloak)   │
└─────────────┘         └─────────────┘         └─────────────┘
```

## Checklist

### 1. Update Protected Resource Metadata

Point `authorization_servers` at your own server instead of Keycloak:

```json
{
  "resource": "https://your-mcp-server.com",
  "authorization_servers": ["https://your-mcp-server.com"],
  "bearer_methods_supported": ["header"]
}
```

### 2. Serve Authorization Server Metadata

**RFC**: [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)

Since `authorization_servers` now points to you, clients will look for metadata at your `/.well-known/oauth-authorization-server`. Serve it with your proxy endpoints:

```json
{
  "issuer": "https://your-mcp-server.com",
  "authorization_endpoint": "https://your-mcp-server.com/oauth/authorize",
  "token_endpoint": "https://your-mcp-server.com/oauth/token",
  "jwks_uri": "https://your-mcp-server.com/oauth/jwks",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

Adjust `grant_types_supported` and `token_endpoint_auth_methods_supported` based on which client patterns you're using.

### 3. Proxy the endpoints

Each proxy endpoint needs to know where to forward requests. Your proxy code reads two environment variables to construct Keycloak URLs:

- `KEYCLOAK_URL` — Keycloak's base URL (e.g. `https://keycloak.kin.co`)
- `KEYCLOAK_REALM` — the Keycloak realm (e.g. `my-realm`)

Add these to your `.env` file for local dev. These change per environment — your deployment config (Kubernetes manifests, ECS task definitions, etc.) sets them for staging and production.

Your proxy uses these to build the forwarding URLs:

| Your endpoint | Method | Forwards to | Behavior |
|---|---|---|---|
| `/oauth/authorize` | GET | `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` | **Redirect**, not proxy — the browser needs to load the login UI from the auth server's domain |
| `/oauth/token` | POST | `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token` | Proxy the request body and return the response |
| `/oauth/jwks` | GET | `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs` | Proxy the response |

The `/oauth/authorize` endpoint is the exception — it must **redirect**, not proxy. It's user-facing: the browser loads Keycloak's login page with its own CSS/JS. Proxying the HTML would break relative asset paths.

If you're using a static client ([@patterns/oauth-static-client.md](oauth-static-client.md)), also add `KEYCLOAK_CLIENT_ID` to your environment. The proxy overrides `client_id` on the authorize redirect and token exchange so clients don't need to know it — they just talk to your proxy endpoints and the proxy stamps the correct client ID before forwarding to Keycloak.

See [@references/oauth-proxy-pattern.md](../references/oauth-proxy-pattern.md) for the full implementation.

### 4. Add CORS headers

Your MCP server must handle CORS so browser clients can reach the discovery and OAuth endpoints. On every response:

- Read the request's `Origin` header. If present, reflect it back as `Access-Control-Allow-Origin` (don't use a literal `*` — some browsers restrict credentials with wildcard origins). Add a `Vary: Origin` header so caches key on origin.
- Set `Access-Control-Allow-Methods` to `GET, POST, DELETE, OPTIONS`.
- Set `Access-Control-Allow-Headers` to `Content-Type, Authorization, mcp-session-id`.
- Set `Access-Control-Expose-Headers` to `mcp-session-id` so the client can read it from the response.
- For `OPTIONS` preflight requests, return `204 No Content` immediately — don't process them as real requests.

## Issuer mismatch

This creates a mismatch: your metadata says your server is the issuer, but tokens say Keycloak is. No MCP client currently enforces issuer matching. The OAuth 2.0 PRS spec explicitly allows this — see [@references/oauth-proxy-pattern.md](../references/oauth-proxy-pattern.md) for details.

