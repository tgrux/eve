# OAuth (Static Client)

Pre-register a single OAuth client in Keycloak. All MCP clients share this client ID. Use when consumers are known ahead of time (Claude Desktop, VS Code, your own apps).

| | |
|---|---|
| **Prereqs** | [@patterns/implement-oauth.md](implement-oauth.md) |

Context: you're adding OAuth and you know who your consumers are — a fixed set of MCP clients (Claude Desktop, internal tools, specific apps).

Forces:
- OAuth security depends on validating redirect URIs, so they must be locked down — but each consumer has different ones (localhost for dev tools, `claude.ai` for Desktop)
- You want a simple auth setup (one client registration in Keycloak) — but adding a new consumer means someone manually updates Keycloak's redirect URI list
- Pre-registering gives you full control over what's allowed — but it doesn't scale to an open ecosystem of unknown clients

The tradeoff: you accept manual work (updating redirect URIs in Keycloak) in exchange for full control over what's allowed. This works when your consumer list changes rarely. If you don't know all your consumers ahead of time, use [@patterns/oauth-dcr.md](oauth-dcr.md) instead.

## Checklist

### 1. Register a client in Keycloak

The key settings:

- **Client type**: public
- **Client authentication**: off (public client, no secret)
- **Allowed grant types**: `authorization_code`, `refresh_token`
- **Redirect URIs**:
  - `http://localhost:*` (MCP Inspector, local dev)
  - `http://localhost:8080/callback` (Claude Code)
  - `https://claude.ai/api/mcp/auth_callback` (Claude Desktop)
- **Audience**: your MCP server's canonical URI (`MCP_BASE_URL`)
- Add a client scope (e.g. `mcp:tools`) if using scopes

For Keycloak-specific steps, see [@references/keycloak-setup.md](../references/keycloak-setup.md).

### 2. Give clients the client ID

Clients need the client ID from step 1 to initiate the OAuth flow. How they get it depends on your setup:

- If you're using the OAuth proxy ([@patterns/browser-clients.md](browser-clients.md)), the proxy injects it — see that pattern for configuration.
- Otherwise, clients pass it directly when starting the authorization code flow.

### 3. Keycloak metadata

Your Keycloak metadata (`/.well-known/oauth-authorization-server`) should reflect a public client with no DCR:

```json
{
  "token_endpoint_auth_methods_supported": ["none"],
  "grant_types_supported": ["authorization_code", "refresh_token"]
}
```

No `registration_endpoint` — clients use the pre-registered client ID.

### 4. Validate tokens

Same as Implement OAuth steps 3–4. JWT validation doesn't change based on registration strategy.

## Testing

Token rejection tests (audience, expiry, signature, missing token, query string) are in [@patterns/implement-oauth.md](implement-oauth.md) — they apply to all registration strategies. No additional tests needed for static client specifically.

