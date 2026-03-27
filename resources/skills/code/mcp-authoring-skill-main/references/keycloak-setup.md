# MCP OAuth Setup Guide

Practical steps for configuring OAuth 2.1 on an MCP server using Kin's Keycloak.

> **Why this architecture?** See `oauth-proxy-pattern.md`

## Keycloak Configuration

### 1. Create a Client Scope

1. **Keycloak Admin Console** → your realm → **Client scopes**
2. **Create client scope**
   - **Name:** `mcp:tools` (or appropriate for your service)
   - **Type:** `Optional`
   - **Include in token scope:** `On`

### 2. Create (or Configure) the Client

1. **Keycloak Admin Console** → your realm → **Clients** → **Create client** (or open your existing client)
2. Under **Settings**, add **Valid redirect URIs** for every environment that will complete an OAuth flow:

| Environment | Redirect URI |
|-------------|-------------|
| MCP Inspector (local dev) | `http://localhost:*` |
| Claude Code | `http://localhost:8080/callback` |
| Claude Desktop / claude.ai | `https://claude.ai/api/mcp/auth_callback` |

> These URIs are where Keycloak is allowed to send the user after login.
> Without the correct callback for each client, the OAuth flow will fail with an "invalid redirect_uri" error.

### 3. Add an Audience Mapper

The audience (`aud`) claim is how your server knows a token is intended for it.

1. Open your scope → **Mappers** → **Add mapper** → **By configuration** → **Audience**
2. Configure:
   - **Name:** `mcp-server-audience`
   - **Included Custom Audience:** Your server's base URL
   - **Add to access token:** `On`

### 4. Environment-Specific Audiences

| Environment | Audience Value |
|-------------|----------------|
| Local | `http://localhost:3000` |
| Dev | `https://your-service.dev.kin.haus` |
| Production | `https://your-service.kin.haus` |

Options:
- Add multiple audiences to one mapper (simpler)
- Separate realms per environment (stricter)

## MCP Server Configuration

### Environment Variables

```bash
KEYCLOAK_URL=https://keycloak.kin.co
KEYCLOAK_REALM=your-realm
MCP_BASE_URL=https://your-service.kin.haus  # Used for audience validation
```

### Required Endpoints

Your server must expose:

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/oauth-protected-resource` | Resource metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Auth server metadata (RFC 8414) |
| `/oauth/authorize` | Proxy to Keycloak |
| `/oauth/token` | Proxy to Keycloak |
| `/oauth/register` | Proxy to Keycloak — **DCR mode only** (omit when using `KEYCLOAK_CLIENT_ID`) |
| `/oauth/jwks` | Proxy to Keycloak |

See the reference implementation's `src/oauth/endpoints.ts` or `oauth-proxy-pattern.md`.

## Testing with MCP Inspector

### Manual OAuth Flow Testing

1. Start your MCP server locally:
   ```bash
   npm run dev
   ```

2. Launch MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. Connect to your server: `http://localhost:3000/mcp`

4. Complete the OAuth flow when prompted (redirects to Keycloak)

5. Verify tools are accessible after authentication

### Verify Token Claims

```bash
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Check that:
- `aud` matches your `MCP_BASE_URL`
- `scope` includes `mcp:tools`

## Troubleshooting

### 401 with audience validation errors

If your server rejects tokens with an audience-related error, the Keycloak audience mapper is likely missing or misconfigured.

1. Decode the token (command above) and check the `aud` claim. If it's missing or doesn't match your `MCP_BASE_URL`, the mapper isn't working.
2. In Keycloak Admin Console, verify:
   - The `mcp:tools` client scope has an **Audience** mapper
   - **Included Custom Audience** matches your server's `MCP_BASE_URL` exactly (including protocol and no trailing slash)
   - **Add to access token** is `On`
   - The client scope is assigned to the client being used
3. Request a fresh token after making changes — existing tokens won't pick up mapper updates.
