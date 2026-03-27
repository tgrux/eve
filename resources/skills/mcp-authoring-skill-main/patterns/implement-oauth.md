# Implement OAuth

What the MCP server (resource server) must do to support OAuth.

| | |
|---|---|
| **Prereqs** | [@patterns/base-server.md](base-server.md) |
| **Constraints** | Keycloak as the authorization server |

The MCP server is an OAuth 2.1 **resource server**. It validates tokens and serves discovery metadata. Everything else — client registration, PKCE, grant types, client authentication — is between the client and Keycloak.

At Kin, we use Keycloak as our **authorization server**. For Keycloak-specific configuration (realms, client scopes, audience mappers), see [@references/keycloak-setup.md](../references/keycloak-setup.md).

## Checklist

### 1. Serve Protected Resource Metadata

**Spec**: MCP Authorization Spec §Authorization Server Discovery
**RFC**: [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)

This is how clients discover where to authenticate. When a client connects to your MCP server for the first time, it needs to know: "who do I talk to to get a token?" This endpoint answers that question — it points clients to the authorization server.

Serve at `/.well-known/oauth-protected-resource`:

```json
{
  "resource": "https://your-mcp-server.com",
  "authorization_servers": ["https://your-auth-server.com"],
  "bearer_methods_supported": ["header"]
}
```

- `resource` MUST be the canonical URI of the MCP server
- `authorization_servers` MUST contain at least one authorization server
- If you proxy OAuth endpoints through your MCP server, `authorization_servers` points to yourself

### 2. Return 401 with discovery hint

**Spec**: MCP Authorization Spec §Protected Resource Metadata Discovery Requirements
**RFC**: [RFC 9728 §3](https://datatracker.ietf.org/doc/html/rfc9728#section-3), [RFC 6750 §3](https://datatracker.ietf.org/doc/html/rfc6750#section-3)

When a request arrives without a valid Bearer token, respond with:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://your-mcp-server.com/.well-known/oauth-protected-resource"
```

The MCP spec requires at least **one of**: this header OR the well-known URI from step 1. They are not mutually exclusive — do both, since the well-known URI enables proactive discovery and the 401 header handles the "tried without a token" case.

### 3. Validate Bearer tokens on every request

**Spec**: MCP Authorization Spec §Access Token Usage, §Token Handling
**RFC**: [RFC 6750 — Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)

Extract token from `Authorization: Bearer <token>` header. Validate:

| Check | Reject with | Reference |
|-------|-------------|-----------|
| Token signature | 401 | OAuth 2.1 §5.2 |
| Token expiry (`exp`) | 401 | OAuth 2.1 §5.2 |
| Issuer (`iss`) matches Keycloak | 401 | OAuth 2.1 §5.2 |
| **Audience (`aud`) includes this MCP server** | 401 | RFC 8707 |

Tokens MUST NOT be accepted from URI query strings — header only.

### 4. Validate audience

**Spec**: MCP Authorization Spec §Token Audience Binding and Validation, §Access Token Privilege Restriction
**RFC**: [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)

The MCP spec says this three separate times:

> "MCP servers MUST validate that access tokens were issued specifically for them as the intended audience."

> "MCP servers MUST only accept tokens specifically intended for themselves and MUST reject tokens that do not include them in the audience claim."

> "MCP servers MUST validate access tokens before processing the request, ensuring the access token is issued specifically for the MCP server."

The `aud` claim in the JWT must match your server's canonical URI (the `resource` value from step 1). This prevents a token issued for MCP Server A from being replayed against MCP Server B.

### 5. Never pass through tokens to upstream APIs

**Spec**: MCP Authorization Spec §Access Token Privilege Restriction
**RFC**: [RFC 8707 §1.1](https://www.rfc-editor.org/rfc/rfc8707.html#section-1.1)

If your MCP server calls other APIs (databases, internal services, third-party APIs), get a separate token for each. The token the client sent you is scoped to YOUR server. Forwarding it is a security violation and breaks the audience binding from step 4.

## What the MCP server does NOT do

| Concern | Who handles it | Spec reference |
|---------|---------------|----------------|
| PKCE (S256) | Client + Keycloak | MCP Spec §Authorization Code Protection |
| Client registration (DCR) | Keycloak | RFC 7591 |
| Client ID Metadata Documents | Client + Keycloak | draft-ietf-oauth-client-id-metadata-document-00 |
| Grant type enforcement | Keycloak | OAuth 2.1 §4 |
| Client authentication | Keycloak | OAuth 2.1 §2.4 |
| Redirect URI validation | Keycloak | OAuth 2.1 §4.1.1 |

## Error codes summary

| Status | When | RFC |
|--------|------|-----|
| 401 | No token, invalid token, expired token, wrong audience | RFC 6750 §3.1 |
| 400 | Malformed authorization request | RFC 6750 §3.1 |

## Testing

These tests verify the resource server requirements from the checklist above. Token validation is HTTP middleware, not MCP protocol — test at the HTTP layer, not through `InMemoryTransport`. Mint JWTs with controlled claims using your language's JWT library and a test signing key.

For MCP-layer testing (tools, resources), see [@patterns/testing.md](testing.md).

### RFC 9728: Protected Resource Metadata

Verifies checklist steps 1 and 2.

- `GET /.well-known/oauth-protected-resource` returns 200 with `resource` matching the server's canonical URI and a non-empty `authorization_servers` array
- Request to `/mcp` with no `Authorization` header returns 401 with `WWW-Authenticate: Bearer resource_metadata="https://<your-server>/.well-known/oauth-protected-resource"`

### RFC 8707: Audience Validation

Verifies checklist step 4. This is the most commonly broken requirement.

- Mint a token with `aud: "https://some-other-server.com"` (everything else valid). Assert 401.
- Mint a token with `aud` omitted entirely. Assert 401.
- Mint a token with `aud` matching the server's canonical URI. Assert request succeeds.

### RFC 6750: Bearer Token Usage

Verifies checklist step 3.

- Mint a token with `exp` in the past. Assert 401.
- Mint a token signed with a key the server doesn't trust. Assert 401.
- Mint a token with `iss` set to an unknown issuer. Assert 401.
- Send a valid token as a query parameter (`?access_token=...`) instead of the `Authorization` header. Assert 401 — the MCP spec requires header only.

### What not to test

- Valid token passes through — that's testing the JWT library, not your code.
- PKCE, grant types, redirect URIs, client authentication — that's Keycloak's job (see "What the MCP server does NOT do" above).

## What's next?

Pick your client type and optional additions:
- Public clients (Claude Desktop, CLI tools, browser apps) → [@patterns/oauth-static-client.md](oauth-static-client.md) or [@patterns/oauth-dcr.md](oauth-dcr.md)
- Confidential clients (backend services, CI, server-to-server) → [@patterns/oauth-confidential-client.md](oauth-confidential-client.md)
- Both → implement both patterns
- Do you need to support browser-based clients (Claude Desktop, ChatGPT)? They can't reach Keycloak directly → [@patterns/browser-clients.md](browser-clients.md)
- Granular per-tool access control with scopes → [@patterns/oauth-scopes.md](oauth-scopes.md) (planned)
