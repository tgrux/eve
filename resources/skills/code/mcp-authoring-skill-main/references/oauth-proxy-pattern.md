# OAuth Proxy Pattern for MCP Servers

This document explains why and how to implement the OAuth proxy pattern for MCP servers that need to support browser-based clients.

## Two OAuth Modes

Before diving in, decide which mode fits your use case:

| Mode | When to use | `KEYCLOAK_CLIENT_ID` | DCR endpoint |
|------|------------|---------------------|--------------|
| **Static client** | Consumers are known (e.g. only Claude Desktop) | Set to your pre-registered Keycloak client | Not mounted |
| **DCR** | Arbitrary MCP clients need to self-register | Not set | Proxied to Keycloak |

**Start with static client mode.** It's simpler — you pre-register one client in Keycloak, add the redirect URIs you need (e.g. `https://claude.ai/api/mcp/auth_callback`), and you're done. DCR adds complexity that's only justified when you can't know your consumers ahead of time.

### How static client mode works

When `KEYCLOAK_CLIENT_ID` is set:
1. The server **overrides `client_id`** on `/oauth/authorize` and `/oauth/token` requests before proxying them to Keycloak
2. The `/oauth/register` endpoint is **not mounted**
3. The `/.well-known/oauth-authorization-server` metadata **omits `registration_endpoint`**

Clients don't need to know or care — they hit the same OAuth endpoints, the server just stamps the correct client_id.

### How DCR mode works

When `KEYCLOAK_CLIENT_ID` is **not** set:
1. The server proxies `/oauth/register` to Keycloak's DCR endpoint, solving CORS
2. Each client self-registers and gets its own `client_id`
3. The metadata advertises `registration_endpoint`

## The Problem: CORS + DCR Incompatibility

The MCP Authorization Spec requires:
- OAuth 2.0 Protected Resource Metadata (RFC 9728)
- Dynamic Client Registration (RFC 7591)
- Audience validation (RFC 8707)

**CORS and DCR are fundamentally incompatible.**

CORS requires knowing client origins ahead of time. DCR exists precisely because clients are unknown. Even if Keycloak supported configurable CORS on DCR endpoints, there would be no origins to configure.

Browser-based MCP clients (Claude Desktop, VS Code, ChatGPT) cannot call Keycloak directly. Only pure CLI tools (Claude Code, Codex) bypass CORS because they don't use browser runtimes.

### The Symptom

When CORS blocks requests, clients show vague errors:

```
⚠ There was an error connecting to the MCP server. Please check
  your server URL and make sure your server handles auth correctly.
```

The actual CORS error is only visible in browser dev tools.

## The Solution: Proxy OAuth Endpoints

Proxy all OAuth endpoints through the MCP server (required in both modes):

> **Critical distinction:** The `/authorize` endpoint must **redirect** to Keycloak, not proxy the response. It's user-facing—the browser needs to load Keycloak's login UI (CSS/JS) from Keycloak's domain. If you proxy the HTML, relative asset paths break. The `/token`, `/register`, and `/jwks` endpoints are API calls with no UI, so those can be proxied.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  MCP Client │ ──────> │  MCP Server │ ──────> │  Keycloak   │
│             │  OAuth  │   (proxy)   │  proxy  │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

The MCP server:
1. Serves `/.well-known/oauth-protected-resource` with `authorization_servers` pointing to itself
2. Serves `/.well-known/oauth-authorization-server` with proxy endpoints
3. Proxies `/oauth/authorize`, `/oauth/token`, `/oauth/jwks` to Keycloak
4. In DCR mode: also proxies `/oauth/register` to Keycloak

## Full Implementation

```typescript
// src/oauth/endpoints.ts
import type { Router } from "express";
import express from "express";

interface OAuthConfig {
  baseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId?: string; // Set for static client mode, omit for DCR
}

export function createOAuthRouter(config: OAuthConfig): Router {
  const router = express.Router();
  const { baseUrl, keycloakUrl, keycloakRealm, keycloakClientId } = config;

  // OAuth 2.0 Protected Resource Metadata (RFC 9728)
  router.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      scopes_supported: ["mcp:tools"],
      bearer_methods_supported: ["header"],
    });
  });

  // OAuth 2.0 Authorization Server Metadata (RFC 8414)
  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    const metadata: Record<string, unknown> = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      jwks_uri: `${baseUrl}/oauth/jwks`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "mcp:tools"],
      token_endpoint_auth_methods_supported: ["none"],
    };

    // Only advertise DCR when no static client is configured
    if (!keycloakClientId) {
      metadata["registration_endpoint"] = `${baseUrl}/oauth/register`;
      (metadata["token_endpoint_auth_methods_supported"] as string[]).push("client_secret_post");
    }

    res.json(metadata);
  });

  // Authorization endpoint - redirect to Keycloak
  router.get("/oauth/authorize", (req, res) => {
    const authUrl = new URL(
      `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`,
    );

    for (const [key, value] of Object.entries(req.query)) {
      if (value && typeof value === "string") {
        authUrl.searchParams.set(key, value);
      }
    }

    // Static client mode: stamp our pre-registered client_id
    if (keycloakClientId) {
      authUrl.searchParams.set("client_id", keycloakClientId);
    }

    res.redirect(authUrl.toString());
  });

  // Token endpoint - proxy to Keycloak
  router.post(
    "/oauth/token",
    express.urlencoded({ extended: true }),
    async (req, res) => {
      const tokenUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`;

      const body = req.body as Record<string, string>;
      if (keycloakClientId) {
        body["client_id"] = keycloakClientId;
      }

      try {
        const response = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(body).toString(),
        });

        const tokenData = await response.json();

        if (!response.ok) {
          console.error("Token proxy failed:", response.status, tokenData);
          res.status(response.status).json(tokenData);
          return;
        }

        res.json(tokenData);
      } catch (error) {
        console.error("Token endpoint proxy error:", error);
        res.status(500).json({
          error: "server_error",
          error_description: "Failed to process token request",
        });
      }
    },
  );

  // JWKS endpoint - proxy to Keycloak
  router.get("/oauth/jwks", async (_req, res) => {
    const jwksUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`;

    try {
      const response = await fetch(jwksUrl);
      const jwksData = await response.json();

      if (!response.ok) {
        console.error("JWKS proxy failed:", response.status, jwksData);
        res.status(response.status).json(jwksData);
        return;
      }

      res.json(jwksData);
    } catch (error) {
      console.error("JWKS endpoint proxy error:", error);
      res.status(500).json({
        error: "server_error",
        error_description: "Failed to fetch JWKS",
      });
    }
  });

  // Dynamic Client Registration (RFC 7591) - DCR mode only
  if (!keycloakClientId) {
    router.post("/oauth/register", express.json(), async (req, res) => {
      const dcrUrl = `${keycloakUrl}/realms/${keycloakRealm}/clients-registrations/openid-connect`;

      const body = req.body as Record<string, unknown>;
      const clientMetadata = {
        client_name: body["client_name"] ?? "MCP Client",
        redirect_uris: body["redirect_uris"] ?? ["http://127.0.0.1:*/callback"],
        grant_types: body["grant_types"] ?? ["authorization_code", "refresh_token"],
        response_types: body["response_types"] ?? ["code"],
        token_endpoint_auth_method: body["token_endpoint_auth_method"] ?? "none",
      };

      try {
        const response = await fetch(dcrUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientMetadata),
        });

        const responseData = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          console.error("DCR failed:", response.status, responseData);
          res.status(response.status).json(responseData);
          return;
        }

        res.status(201).json(responseData);
      } catch (error) {
        console.error("DCR error:", error);
        res.status(500).json({
          error: "server_error",
          error_description: "Client registration failed",
        });
      }
    });
  }

  return router;
}

export function getOAuthConfigFromEnv(): OAuthConfig | undefined {
  const keycloakUrl = process.env["KEYCLOAK_URL"];
  const keycloakRealm = process.env["KEYCLOAK_REALM"];
  const keycloakClientId = process.env["KEYCLOAK_CLIENT_ID"];
  const baseUrl =
    process.env["MCP_BASE_URL"] ??
    `http://localhost:${process.env["MCP_PORT"] ?? 3000}`;

  if (!keycloakUrl || !keycloakRealm) {
    return undefined;
  }

  return { baseUrl, keycloakUrl, keycloakRealm, keycloakClientId };
}
```

## The Issuer Mismatch Tradeoff

This creates a mismatch between metadata and tokens:

| Field | Value |
|-------|-------|
| Authorization server metadata `issuer` | `https://mcp-server.com` (our proxy) |
| Token `iss` claim | `https://keycloak.example.com/realms/xxx` (Keycloak) |

**These don't match.** A strict OAuth client could reject this.

**In practice, no MCP client currently enforces issuer matching.** Claude Desktop and other clients work fine with this mismatch. The OAuth 2.0 PRS spec explicitly allows this:

> "The OAuth2 PRS specification does not pose any restrictions on what the server metadata for the authorization server may contain. Particularly, the issuer property and all the endpoints contained in the metadata do not have to match the authorization server URI."

If a future client enforces strict issuer validation, revisit this decision.

## Security Model

The MCP spec's security model focuses on **audience validation**, not issuer matching:

> "MCP servers MUST validate that access tokens were issued specifically for them as the intended audience" — MCP Authorization Spec

Validate:
1. **Audience (`aud`)** — token must be intended for the server's URL
2. **Signature** — verified against Keycloak's JWKS (fetched via proxy)
3. **Expiration** — token must not be expired

## CORS Configuration

The MCP server must allow CORS for discovery endpoints:

```typescript
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // Reflect the Origin header instead of using a literal "*"
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id",
  );
  res.header("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
```

## Usage

```typescript
import { createOAuthRouter, getOAuthConfigFromEnv } from "./oauth/endpoints.js";

const app = express();

// Mount OAuth routes if Keycloak is configured
const oauthConfig = getOAuthConfigFromEnv();
if (oauthConfig) {
  app.use(createOAuthRouter(oauthConfig));
  console.error("🔐 OAuth endpoints enabled");
} else {
  console.error("⚠️ OAuth not configured");
}
```

## Prior Art

| Implementation | Approach |
|----------------|----------|
| **Hypr MCP Gateway** | `authorization_servers` points to gateway, proxies to upstream IdP |
| **Quarkus OIDC Proxy** | Full proxy, replaces IdP URLs with proxy URLs in metadata |
| **Agent Gateway** | Wraps Keycloak with "provider-specific adapters" for CORS/DCR |

## References

### Specifications
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 9728 - OAuth Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)

### Implementation Guides
- [Aaron Parecki - Let's fix OAuth in MCP](https://aaronparecki.com/2025/04/03/15/oauth-for-model-context-protocol)
- [Christian Posta - MCP Authorization with DCR](https://blog.christianposta.com/understanding-mcp-authorization-with-dynamic-client-registration/)
