---
name: Kin MCP Server
description: This skill should be used when the user asks to "create a new MCP", "create an MCP server", "build an MCP", "scaffold an MCP", "new MCP for [service name]", "help me add oauth to my MCP", "add authentication to MCP", "add auth to my MCP", "deploy my MCP server", or needs guidance on building MCP servers at Kin Insurance. Trigger on any mention of creating/building an MCP regardless of whether they say "server". Supports TypeScript, Python, and Ruby.
version: 0.2.0
---

# Kin MCP Server Development

Pattern catalog for building MCP servers at Kin. Each pattern is a self-contained file with prerequisites, context, forces, and a checklist. Start with **Base Server**, then compose what you need.

```
┌─────────────────────┐
│    Base Server       │  always start here
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│  Implement OAuth     │  resource server checklist
└──┬───────────────┬───┘
   │               │
   ▼               ▼
┌────────────┐  ┌─────────────────┐
│Registration│  │OAuth Proxy      │  only if browser
│ (pick one) │  │                 │  clients (Claude
└──┬────┬────┘  └─────────────────┘  Desktop)
   │    │
   ▼    ▼
Static  DCR  Confidential
Client       Client
```

## First: What Language?

Ask: **TypeScript, Python, or Ruby?**

Code examples are TypeScript. The auth patterns are language-agnostic — adapt to your SDK and web framework (FastAPI, Sinatra, etc.).

| Language | SDK |
|----------|-----|
| TypeScript | https://github.com/modelcontextprotocol/typescript-sdk |
| Python | https://github.com/modelcontextprotocol/python-sdk |
| Ruby | https://github.com/modelcontextprotocol/ruby-sdk |

If TypeScript:
- Use Node.js, not Bun (Bun is incompatible with `dd-trace`)
- Reference implementation: https://github.com/kin/mcp-streamable-http-template-ts (study the patterns, don't clone it)
- Copy `assets/tsconfig.json` and `assets/oxlint.json` into the project root

## Patterns

| Pattern | File | When |
|---------|------|------|
| Base Server | `patterns/base-server.md` | Always — start here |
| Implement OAuth | `patterns/implement-oauth.md` | Resource server checklist — what every OAuth MCP server must do |
| Browser Clients | `patterns/browser-clients.md` | Proxy OAuth endpoints so browser-based clients can reach Keycloak |
| OAuth (Static Client) | `patterns/oauth-static-client.md` | Known consumers, pre-registered client ID |
| OAuth (DCR) | `patterns/oauth-dcr.md` | Unknown clients self-register |
| OAuth (Confidential Client) | `patterns/oauth-confidential-client.md` | Backend services, CI pipelines, server-to-server |
| Testing | `patterns/testing.md` | Automated tests with vitest and InMemoryTransport |
| Observability | `patterns/observability.md` | Datadog instrumentation |
| Deployment | `patterns/deployment.md` | Getting ready for production (planned) |

### Why not static tokens?

Use `patterns/oauth-confidential-client.md` instead. We have Keycloak — a confidential client with `client_credentials` gives you machine-to-machine access with token expiration, rotation, audit, and revocation. Static tokens have none of that.

## Verification and troubleshooting

See `references/verification-and-testing.md` for testing with MCP Inspector, Claude Code, Claude Desktop, and common failure modes.

## Reference Documents

| Document | Covers |
|----------|--------|
| `references/mcp-authorization-spec.md` | Official MCP auth spec (RFC 9728, 7591, OAuth 2.1) |
| `references/oauth-proxy-pattern.md` | Full proxy implementation and CORS rationale |
| `references/keycloak-setup.md` | Keycloak client scopes, audience mappers, redirect URIs |
| `references/verification-and-testing.md` | Testing OAuth flows, client config, troubleshooting |

Asset files (TypeScript only): `assets/tsconfig.json`, `assets/oxlint.json`
