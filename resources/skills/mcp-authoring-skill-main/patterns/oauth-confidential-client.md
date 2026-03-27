# OAuth (Confidential Client)

OAuth for server-side consumers that can securely store a client secret. Backend services, CI pipelines (GitHub Actions), agent orchestrators, server-to-server integrations.

| | |
|---|---|
| **Prereqs** | [@patterns/implement-oauth.md](implement-oauth.md) |

Context: you need programmatic access to your MCP server from infrastructure you control — CI pipelines, backend services, internal tools. There may or may not be a human in the loop.

Forces:
- You need proper token-based auth, but there may be no human to click through a consent screen — so the interactive authorization code flow doesn't always work
- Short-lived tokens are more secure than static secrets, but the client secret that produces them is long-lived — a leaked secret has a bigger blast radius than a leaked token
- You want to limit what each consumer can do, but all consumers hit the same MCP server and get tokens from the same Keycloak instance

The tradeoff: you take on the operational burden of managing secrets (secure storage, rotation, per-consumer registration) in exchange for proper token-based auth without requiring human interaction.

## Grant types

Confidential clients typically use one of two grant types:

| Grant type | Human in the loop? | Token represents |
|---|---|---|
| `authorization_code` | Yes — user consents via browser | The user |
| `client_credentials` | No | The application itself |

**Authorization code**: a web app backend where users log in, consent, and the backend exchanges the code + client secret for a token. The token carries the user's identity (`sub` claim).

**Client credentials**: machine-to-machine. The client authenticates directly with `client_id` + `client_secret` and gets a token. No browser redirect, no user consent, no `sub` claim. The MCP spec doesn't explicitly cover this grant type, but nothing prohibits it — it's standard OAuth 2.1.

## Checklist

### 1. Register a confidential client in Keycloak

The key settings:

- **Client type**: confidential
- **Client authentication**: client secret (post or basic)
- **Allowed grant types**: `authorization_code` and/or `client_credentials` depending on whether a human is involved
- **Audience**: your MCP server's canonical URI (`MCP_BASE_URL`)

For Keycloak specifics, see [@references/keycloak-setup.md](../references/keycloak-setup.md).

### 2. Keycloak metadata

**RFC**: [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)

Your Keycloak metadata (`/.well-known/oauth-authorization-server`) must advertise support for confidential clients:

```json
{
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "grant_types_supported": ["authorization_code", "client_credentials"]
}
```

If your MCP server proxies Keycloak metadata ([@patterns/browser-clients.md](browser-clients.md)), update the proxy to include these values. If clients talk directly to Keycloak, configure it there.

### 3. Handle tokens without user identity

**RFC**: [OAuth 2.1 §4.2 — Client Credentials Grant](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-4.2)

Tokens from the `client_credentials` grant have no `sub` claim — there's no user. If your MCP server extracts user identity from tokens (for audit logs, per-user data, etc.), handle this case:

```typescript
const userId = payload.sub ?? `client:${payload.azp ?? payload.client_id}`;
```

This is an application-level decision. The MCP spec doesn't prescribe how to handle identity — it just requires token validation (see implement-oauth checklist steps 3–4).

### 4. Store secrets securely

- CI pipelines: use the platform's secret store (GitHub Actions secrets, GitLab CI variables)
- Backend services: use environment variables from a secrets manager, not config files
- Never commit secrets to source control
- Rotate secrets on a schedule — Keycloak issues ephemeral tokens, but the secret itself is long-lived

## Token exchange (client credentials)

For reference, the client credentials exchange looks like:

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=deploy-pipeline
&client_secret=s3cret
&resource=https://your-mcp-server.com
```

The `resource` parameter is required by the MCP spec ([RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html)) — it binds the token to your MCP server's audience.
