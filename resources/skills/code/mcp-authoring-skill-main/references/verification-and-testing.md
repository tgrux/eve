# Verification and Testing

How to verify your MCP server's OAuth setup works end-to-end.

## MCP Inspector

1. `npx @modelcontextprotocol/inspector`
2. Transport Type → `Streamable HTTP`, URL → `http://localhost:3000/mcp`
3. Open OAuth Settings → Quick OAuth Flow
   - Succeeds → close settings, click Connect
   - Fails → click Continue to step through each phase (discovery, registration, authorize, token)
4. Verify tools appear under the Tools tab

## Claude Code

```bash
claude mcp add --transport http \
    --client-id your-client-id \
    --callback-port 8080 \
    your-mcp http://localhost:3000/mcp
```

## Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "your-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "oauth": {
        "clientId": "your-client-id",
        "callbackPort": 8080
      }
    }
  }
}
```

The `callbackPort` must match the redirect URI registered in Keycloak (`http://localhost:8080/callback`).

## Verifying token claims

```bash
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Check that `aud` matches your `MCP_BASE_URL`.

## Common failures

| Symptom | Likely cause |
|---------|-------------|
| Discovery fails | `/.well-known/oauth-authorization-server` not served or CORS blocking |
| Registration fails (DCR) | Keycloak DCR not enabled, or `/oauth/register` not proxied |
| "invalid redirect_uri" | URI not in Keycloak. For Claude Desktop: add `https://claude.ai/api/mcp/auth_callback` |
| Token exchange fails | Redirect URI mismatch or Keycloak client misconfigured |
| 401 on tool calls | Audience (`aud`) missing or wrong — check `MCP_BASE_URL` matches token's `aud` |
