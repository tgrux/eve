# OAuth (DCR)

Dynamic Client Registration — unknown MCP clients register themselves to get a client ID.

| | |
|---|---|
| **Prereqs** | [@patterns/implement-oauth.md](implement-oauth.md) |

> **You almost certainly don't need this.** DCR creates a new client in Keycloak every time an unknown MCP client connects. Keycloak has a hard limit of ~200 clients per realm, and each registration adds noise to your client list with no cleanup mechanism. Unless you're building a platform where truly unknown third parties need to connect, use [@patterns/oauth-static-client.md](oauth-static-client.md) (one shared client for all known consumers) or `patterns/oauth-confidential-client.md` (server-to-server). DCR is documented here for completeness, not as a recommendation.

Context: you're building an MCP server that needs to accept connections from clients you can't predict or enumerate — a public API, an open ecosystem, a platform where third parties build integrations.

Forces:
- You can't pre-register every consumer because you don't know who they are — but OAuth requires a client ID
- Self-registration solves the onboarding problem — but every registration creates a permanent client in Keycloak with no automatic cleanup
- Keycloak has a ~200 client limit per realm, so DCR at any meaningful scale will exhaust it

## Checklist

### 1. Enable DCR in Keycloak

**RFC**: [RFC 7591 — OAuth 2.0 Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)

For Keycloak: Admin Console → realm → Realm Settings → Client Registration → enable.

### 2. Keycloak metadata

Your Keycloak metadata (`/.well-known/oauth-authorization-server`) must advertise the registration endpoint:

```json
{
  "registration_endpoint": "https://your-server.com/oauth/register",
  "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
  "grant_types_supported": ["authorization_code", "refresh_token"]
}
```

`client_secret_post` is included because DCR-registered clients may receive a client secret from Keycloak.

### 3. Expose the registration endpoint

If any of your DCR clients might be browser-based, you need the OAuth proxy ([@patterns/browser-clients.md](browser-clients.md)) — you can't configure CORS for origins you don't know. Add `/oauth/register` to the proxy, forwarding to Keycloak's DCR endpoint at `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/clients-registrations/openid-connect`.

If your DCR clients are all CLI or server-side, they can call Keycloak's registration endpoint directly. Point `registration_endpoint` in your Keycloak metadata at Keycloak's DCR URL.

### 4. Do NOT set a static client ID

No `KEYCLOAK_CLIENT_ID` — each client self-registers and gets its own. If using the proxy, don't override `client_id` on authorize and token requests.

### 5. Validate tokens

Same as Implement OAuth steps 3–4. JWT validation doesn't change based on registration strategy.

## Testing

Token rejection tests are in [@patterns/implement-oauth.md](implement-oauth.md) — they apply to all registration strategies.

DCR adds one thing to test:

- Valid registration request to `/oauth/register` returns 201 with a `client_id` in the response body.
- Missing required fields returns 400.

## Env vars

| Variable | Required | Description |
|---|---|---|
| `MCP_BASE_URL` | Yes | Public URL, used for audience validation |
| `KEYCLOAK_URL` | Yes | Keycloak base URL |
| `KEYCLOAK_REALM` | Yes | Keycloak realm |
