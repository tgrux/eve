# MCP Authorization Specification

> Source: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
> Protocol Revision: 2025-11-25
>
> **Important:** When viewing MCP docs at modelcontextprotocol.io, always verify you're on the latest stable revision (currently 2025-11-25), not a draft.

## Introduction

### Purpose and Scope

The Model Context Protocol provides authorization capabilities at the transport level,
enabling MCP clients to make requests to restricted MCP servers on behalf of resource
owners. This specification defines the authorization flow for HTTP-based transports.

### Protocol Requirements

Authorization is **OPTIONAL** for MCP implementations. When supported:

* Implementations using an HTTP-based transport **SHOULD** conform to this specification.
* Implementations using an STDIO transport **SHOULD NOT** follow this specification, and
  instead retrieve credentials from the environment.
* Implementations using alternative transports **MUST** follow established security best
  practices for their protocol.

### Standards Compliance

This authorization mechanism is based on established specifications listed below, but
implements a selected subset of their features to ensure security and interoperability
while maintaining simplicity:

* OAuth 2.1 IETF DRAFT ([draft-ietf-oauth-v2-1-13](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13))
* OAuth 2.0 Authorization Server Metadata ([RFC8414](https://datatracker.ietf.org/doc/html/rfc8414))
* OAuth 2.0 Dynamic Client Registration Protocol ([RFC7591](https://datatracker.ietf.org/doc/html/rfc7591))
* OAuth 2.0 Protected Resource Metadata ([RFC9728](https://datatracker.ietf.org/doc/html/rfc9728))
* OAuth Client ID Metadata Documents ([draft-ietf-oauth-client-id-metadata-document-00](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00))

## Roles

A protected *MCP server* acts as an OAuth 2.1 resource server, capable of accepting and responding to protected resource requests using access tokens.

An *MCP client* acts as an OAuth 2.1 client, making protected resource requests on behalf of a resource owner.

The *authorization server* is responsible for interacting with the user (if necessary) and issuing access tokens for use at the MCP server.

## Overview

1. Authorization servers **MUST** implement OAuth 2.1 with appropriate security measures for both confidential and public clients.

2. Authorization servers and MCP clients **SHOULD** support OAuth Client ID Metadata Documents.

3. Authorization servers and MCP clients **MAY** support the OAuth 2.0 Dynamic Client Registration Protocol ([RFC7591](https://datatracker.ietf.org/doc/html/rfc7591)).

4. MCP servers **MUST** implement OAuth 2.0 Protected Resource Metadata ([RFC9728](https://datatracker.ietf.org/doc/html/rfc9728)). MCP clients **MUST** use OAuth 2.0 Protected Resource Metadata for authorization server discovery.

5. MCP authorization servers **MUST** provide at least one of the following discovery mechanisms:
   * OAuth 2.0 Authorization Server Metadata ([RFC8414](https://datatracker.ietf.org/doc/html/rfc8414))
   * OpenID Connect Discovery 1.0

## Authorization Server Discovery

### Authorization Server Location

MCP servers **MUST** implement the OAuth 2.0 Protected Resource Metadata ([RFC9728](https://datatracker.ietf.org/doc/html/rfc9728)) specification to indicate the locations of authorization servers. The Protected Resource Metadata document returned by the MCP server **MUST** include the `authorization_servers` field containing at least one authorization server.

### Protected Resource Metadata Discovery Requirements

MCP servers **MUST** implement one of the following discovery mechanisms:

1. **WWW-Authenticate Header**: Include the resource metadata URL in the `WWW-Authenticate` HTTP header under `resource_metadata` when returning `401 Unauthorized` responses.

2. **Well-Known URI**: Serve metadata at a well-known URI:
   * At the path of the server's MCP endpoint: `https://example.com/public/mcp` could host metadata at `https://example.com/.well-known/oauth-protected-resource/public/mcp`
   * At the root: `https://example.com/.well-known/oauth-protected-resource`

Example 401 response with scope guidance:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         scope="files:read"
```

### Authorization Server Metadata Discovery

For issuer URLs with path components (e.g., `https://auth.example.com/tenant1`), clients **MUST** try endpoints in the following priority order:

1. OAuth 2.0 Authorization Server Metadata with path insertion: `https://auth.example.com/.well-known/oauth-authorization-server/tenant1`
2. OpenID Connect Discovery 1.0 with path insertion: `https://auth.example.com/.well-known/openid-configuration/tenant1`
3. OpenID Connect Discovery 1.0 path appending: `https://auth.example.com/tenant1/.well-known/openid-configuration`

For issuer URLs without path components (e.g., `https://auth.example.com`), clients **MUST** try:

1. OAuth 2.0 Authorization Server Metadata: `https://auth.example.com/.well-known/oauth-authorization-server`
2. OpenID Connect Discovery 1.0: `https://auth.example.com/.well-known/openid-configuration`

## Client Registration Approaches

MCP supports three client registration mechanisms:

* **Client ID Metadata Documents**: When client and server have no prior relationship (most common)
* **Pre-registration**: When client and server have an existing relationship
* **Dynamic Client Registration**: For backwards compatibility or specific requirements

Priority order:

1. Use pre-registered client information for the server if available
2. Use Client ID Metadata Documents if the Authorization Server supports it
3. Use Dynamic Client Registration as a fallback
4. Prompt the user to enter the client information if no other option is available

### Dynamic Client Registration

MCP clients and authorization servers **MAY** support the OAuth 2.0 Dynamic Client Registration Protocol [RFC7591](https://datatracker.ietf.org/doc/html/rfc7591) to allow MCP clients to obtain OAuth client IDs without user interaction.

## Scope Selection Strategy

MCP clients **SHOULD** follow the principle of least privilege. During the initial authorization handshake:

1. **Use `scope` parameter** from the initial `WWW-Authenticate` header in the 401 response, if provided
2. **If `scope` is not available**, use all scopes defined in `scopes_supported` from the Protected Resource Metadata document

## Resource Parameter Implementation

MCP clients **MUST** implement Resource Indicators for OAuth 2.0 as defined in [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html):

1. **MUST** be included in both authorization requests and token requests.
2. **MUST** identify the MCP server that the client intends to use the token with.
3. **MUST** use the canonical URI of the MCP server.

Examples of valid canonical URIs:

* `https://mcp.example.com/mcp`
* `https://mcp.example.com`
* `https://mcp.example.com:8443`

## Access Token Usage

### Token Requirements

1. MCP client **MUST** use the Authorization request header field:

```
Authorization: Bearer <access-token>
```

Authorization **MUST** be included in every HTTP request from client to server.

2. Access tokens **MUST NOT** be included in the URI query string

### Token Handling

MCP servers **MUST** validate access tokens. MCP servers **MUST** validate that access tokens were issued specifically for them as the intended audience. Invalid or expired tokens **MUST** receive a HTTP 401 response.

MCP clients **MUST NOT** send tokens to the MCP server other than ones issued by the MCP server's authorization server.

MCP servers **MUST NOT** accept or transit any other tokens.

## Error Handling

| Status Code | Description  | Usage                                      |
| ----------- | ------------ | ------------------------------------------ |
| 401         | Unauthorized | Authorization required or token invalid    |
| 403         | Forbidden    | Invalid scopes or insufficient permissions |
| 400         | Bad Request  | Malformed authorization request            |

### Scope Challenge Handling

When a client makes a request with an access token with insufficient scope, the server **SHOULD** respond with:

* `HTTP 403 Forbidden` status code
* `WWW-Authenticate` header with:
  * `error="insufficient_scope"`
  * `scope="required_scope1 required_scope2"`
  * `resource_metadata`
  * `error_description` (optional)

Example:

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
                         scope="files:read files:write user:profile",
                         resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         error_description="Additional file write permission required"
```

## Security Considerations

### Token Audience Binding and Validation

* MCP clients **MUST** include the `resource` parameter in authorization and token requests
* MCP servers **MUST** validate that tokens presented to them were specifically issued for their use

### Communication Security

1. All authorization server endpoints **MUST** be served over HTTPS.
2. All redirect URIs **MUST** be either `localhost` or use HTTPS.

### Authorization Code Protection

MCP clients **MUST** implement PKCE and **MUST** use the `S256` code challenge method.

If `code_challenge_methods_supported` is absent from authorization server metadata, the authorization server does not support PKCE and MCP clients **MUST** refuse to proceed.

### Access Token Privilege Restriction

MCP servers **MUST** validate access tokens before processing the request, ensuring the access token is issued specifically for the MCP server.

MCP servers **MUST** only accept tokens specifically intended for themselves and **MUST** reject tokens that do not include them in the audience claim.

If the MCP server makes requests to upstream APIs, the access token used at the upstream API is a separate token. The MCP server **MUST NOT** pass through the token it received from the MCP client.

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/.well-known/oauth-protected-resource` | Protected Resource Metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Authorization Server Metadata (RFC 8414) |
| `/oauth/authorize` | Authorization endpoint |
| `/oauth/token` | Token endpoint |
| `/oauth/register` | Dynamic Client Registration (RFC 7591) |
| `/oauth/jwks` | JSON Web Key Set |

## References

* [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
* [RFC 9728 - OAuth Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
* [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
* [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
* [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
* [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13)
