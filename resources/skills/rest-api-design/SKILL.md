---
name: rest-api-design
description: Kin REST API design standard. Use when designing, reviewing, or generating REST API endpoints, request/response shapes, error formats, or OpenAPI specs. Encodes Kin's opinionated conventions — non-negotiable for new services.
license: Proprietary
metadata:
  author: kin
---

# Kin REST API Standard

Full reference: https://kininsurance.atlassian.net/wiki/spaces/Skunkworks/pages/2214756373/The+REST+API+Skill

These rules are non-negotiable for new Kin services. When in doubt, follow the rule exactly as written.

---

## URLs

**Structure:** `/api/{version}/{resource}`

- Version is the first segment after `/api/`. Major version only. Prefix with `v`. Never version via headers or query params.
- Resources are **plural nouns**. Use kebab-case for multi-word segments.
- Max nesting depth: **2 resources**. Promote deeper resources to top-level with a filter.
- Singleton sub-resources use singular (e.g., `policies/123/coverage` — one per policy).
- Query params for filtering; path params for identity.

```
# Do
GET  /api/v1/policies
GET  /api/v1/policies/123
GET  /api/v1/insurance-products
GET  /api/v1/policies?status=active&state=FL

# Don't
GET  /api/v1/policy
POST /api/v1/createQuote
GET  /api/v1/insurance_products
GET  /api/v1/opportunities/1/policies/123/quotes/456/changes   # 3 levels deep
```

**Actions** (state transitions, non-CRUD ops): `POST` on a sub-resource noun.

```
POST /api/v1/policies/123/bind
POST /api/v1/policies/123/evaluation
POST /api/v1/applications/456/signature
```

---

## HTTP Methods

| Method | Use | Idempotent | Body |
|--------|-----|-----------|------|
| `GET` | Read resource or collection | Yes | Never |
| `POST` | Create or trigger an action | No | Yes |
| `PUT` | Replace entire resource | Yes | Yes |
| `PATCH` | Partial update (default for updates) | No | Yes |
| `DELETE` | Remove resource | Yes | Never |

- **PATCH** — send only changed fields. This is the default for updates.
- **PUT** — send complete representation. Only when client owns the full resource (config objects, templates).
- Standard methods must be **side-effect free** — a POST that creates an email draft must not also send it. Use a separate action endpoint for side effects.
- If a resource exists but doesn't support a method → **405 Method Not Allowed** (not 404) with `Allow` header listing supported methods. Every resource should respond to every method with the appropriate status — never 404 for an unsupported operation on a known resource.

---

## Status Codes

### Success
| Code | When |
|------|------|
| `200 OK` | Successful GET, PATCH, PUT |
| `201 Created` | POST that created a resource. Include resource in body + `Location` header. |
| `202 Accepted` | Async operation accepted. |
| `204 No Content` | Successful DELETE. No body. |

### Client Errors
| Code | When |
|------|------|
| `400 Bad Request` | Structurally broken — missing fields, wrong types, unparseable body |
| `401 Unauthorized` | No valid auth credentials |
| `403 Forbidden` | Authenticated but wrong role |
| `404 Not Found` | Resource doesn't exist |
| `405 Method Not Allowed` | Resource exists but doesn't support this method |
| `409 Conflict` | Duplicate creation, concurrent modification, wrong resource state |
| `422 Unprocessable Entity` | Well-formed but violates business rules |
| `429 Too Many Requests` | Rate limit exceeded. Include `Retry-After`. |

**400 vs 422:** 400 = structurally broken. 422 = valid structure but server can't process it (business logic, validation, wrong state).

### Server Errors
| Code | When |
|------|------|
| `500 Internal Server Error` | Never intentionally return this |
| `502 Bad Gateway` | Upstream returned invalid response |
| `503 Service Unavailable` | Upstream unreachable. Include `Retry-After` if possible. |

---

## Requests

- All request bodies: `application/json`. No exceptions (except binary assets).
- JSON keys: **camelCase**. No exceptions.
- Never send a body with `GET` or `DELETE`.
- Servers should **ignore unrecognized fields** (forward-compatible clients).
- All request bodies must be valid **UTF-8, NFC normalized**. Reject non-UTF-8. Normalize on ingestion before storage or comparison — the same semantic character can have multiple byte representations and break exact-match lookups.

---

## Responses

**Single resource** — return the object at root:
```json
{
  "id": "123",
  "status": "active",
  "effectiveDate": "2026-03-01",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

- `POST` → return the created resource (`201` + `Location` header)
- `PATCH`/`PUT` → return the full updated resource (client shouldn't need a follow-up GET)
- `DELETE` → `204` with no body
- `null` means absent, **not omitted** — include `null` fields. Omitting a key means "field not returned"; `null` means "no value". Clients must be able to distinguish these.

**PATCH semantics** — JSON Merge Patch (RFC 7396):
- Fields present → updated
- Fields set to `null` → removed/cleared
- Fields absent → unchanged

For fine-grained ops (array manipulation, test-and-set): JSON Patch (RFC 6902) with `Content-Type: application/json-patch+json`.

---

## Errors

All errors follow **RFC 9457 Problem Details** with `Content-Type: application/problem+json`.

```json
{
  "type": "https://api.kin.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The coverageA field must be between 100000 and 500000."
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Always | URI identifying error type. Clients switch on this. Use `about:blank` for generic HTTP errors. |
| `title` | Always | Short, static summary. Same for every occurrence of this error type. |
| `status` | Always | HTTP status code (repeated in body for log/queue consumers). |
| `detail` | Always | Human-readable explanation for this occurrence. Never expose stack traces or internal details. |
| `instance` | Optional | URI identifying this specific occurrence (support/log correlation). |

**Validation errors (422)** — extend with `errors` array:
```json
{
  "type": "https://api.kin.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The request contains 2 invalid fields.",
  "errors": [
    {"field": "email", "message": "is required"},
    {"field": "coverageA", "message": "must be between 100000 and 500000"}
  ]
}
```

**Standard error type slugs:**
| Slug | Status | Meaning |
|------|--------|---------|
| `about:blank` | any | Generic HTTP error |
| `validation-failed` | 422 | Field-level validation (include `errors` array) |
| `not-editable` | 422 | Resource in wrong state |
| `duplicate` | 409 | Resource already exists |
| `upstream-unavailable` | 502/503 | Dependency failure |

Define domain-specific types as needed (`underwriting-failed`, `bind-blocked`). Document in OpenAPI spec.

---

## Collections & Pagination

Every list endpoint wraps results in `data`. Never return a raw JSON array. Never use a resource-specific key like `"policies"`.

```json
{"data": [...]}
```

- Empty collections → `200` with `{"data": []}`. Never `404` for an empty collection.
- Unpaginated endpoints (≤~50 items) still use `data` wrapper.

**Offset-based** (default — use when clients need page numbers or totals):
```
GET /api/v1/policies?page=2&pageSize=25
```
```json
{
  "data": [...],
  "pagination": {"page": 2, "pageSize": 25, "totalItems": 98, "totalPages": 4}
}
```
Defaults: `page=1`, `pageSize=25`, max `pageSize=100`. Note: requires a `COUNT(*)` query — use cursor-based for large/unbounded datasets.

**Cursor-based** (real-time feeds, large datasets, or when `COUNT(*)` is expensive):
```
GET /api/v1/events?cursor=eyJpZCI6MTIzfQ&pageSize=25
```
```json
{
  "data": [...],
  "pagination": {"nextCursor": "eyJpZCI6MTQ4fQ", "hasMore": true}
}
```
Cursors are opaque — clients must not parse or construct them.

---

## Filtering & Sorting

- Simple equality filters: use field name directly (`?status=active&state=FL`)
- Multiple values: comma-separated (`?status=active,cancelled`)
- Free-text search: `q` param (`?q=jane+doe`)
- Sorting: `sort` param, prefix `-` for descending (`?sort=-createdAt,name`)
- Query params: **camelCase** (matches JSON body field names)
- Every `sort` field must be backed by a DB index. Unsupported sort fields → `400`.

---

## Data Types & Serialization

### Money
Never use floats. Use integers in smallest currency unit with explicit currency object.
```json
{"premiumAnnual": {"amount": 245600, "currency": "USD"}}
```
Never encode the unit in the field name (`premiumCents`). Document the unit in OpenAPI description.

### Dates
- Timestamps: ISO 8601, always UTC → `"2026-01-15T10:30:00Z"`
- Date-only: `YYYY-MM-DD` → `"2026-03-01"`

### Booleans
Always `true`/`false` — never `"true"`, `1`, `"Y"`.
Use **positive phrasing** to avoid double negatives (`isActive`, not `isNotDisabled`).
Negative names are acceptable when the default (missing/false) should mean "feature off" (e.g., `skipValidation`).

### Enums
Lowercase strings. Multi-word values: `snake_case`.
```json
{"status": "active", "bindCategory": "new_business", "paymentSchedule": "two_pay"}
```

### Percentages
JSON numbers. No `%` sign in value. Use `Percent` suffix. Whole numbers as integers (`10`), fractional as decimals (`2.5`).

### IDs
Always **strings** in JSON, even if storage uses integers. Future-proofs UUID migration; avoids JS precision loss.

**ID format — prefer Crockford's Base32 + check digit over UUIDs:**
- Character set: A-Z, 0-9, minus I, L, O, U (avoids OCR ambiguity and accidental profanity)
- Optional hyphens for readability (ignored during parsing)
- Check digit: `value mod 37`, per Crockford spec. Catches typos without a DB round-trip. **Do not store check digit in DB** — always compute on the fly.
- Size: 12 chars + check digit (service-scoped); 24 chars + check digit (globally unique)

Why not UUIDs? Base-16 = less compact, no checksum, harder to communicate verbally/OCR.

**Hierarchy in IDs:** Only nest a resource under a parent when the child permanently belongs to that parent and cannot move.
```
# Do — page permanently belongs to a book
/api/v1/books/abcde-123/pages/5678

# Don't — a book can move shelves; shelf is an attribute, not an identifier
/api/v1/shelves/7812/books/abcde-123
```

### Timestamps
Every mutable resource includes `createdAt` and `updatedAt`.

### HTML in strings
Append `Html` to field names that contain HTML: `"noteHtml": "<b>content</b>"`.

---

## Authentication & Authorization

- All requests: JWT Bearer token in `Authorization` header.
- Keycloak is the identity provider. Use `kin-keycloak-auth` gem (Ruby) or equivalent. Don't build custom token validation.
- Permissions via roles in JWT claims. Check in before-action/middleware, not inline.
- Missing/invalid token → `401`. Valid token, wrong role → `403`.
- Same endpoints serve all consumers (agents, customers, internal). Access differentiated by JWT role — not separate URL namespaces.

---

## Versioning

**Bump major version for:**
- Removing or renaming a field
- Changing a field's type
- Changing status code meaning for an endpoint
- Removing an endpoint

**Do NOT bump for:**
- Adding a new optional response field
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new enum value (if clients handle unknowns gracefully)

Previous version must remain operational for **minimum 6 months** after a new version ships, with a documented deprecation date.

Deprecated endpoints return:
```
Deprecation: true
Sunset: Sat, 01 Nov 2026 00:00:00 GMT
Link: </api/v2/policies>; rel="successor-version"
```

---

## Documentation & Observability

- OpenAPI 3.0+ spec required. Auto-generate from code — never hand-maintain drift.
- Swagger UI at `/docs` (not `/api-docs`, `/swagger`, etc.)
- Health endpoint at `GET /health` (unauthenticated, no downstream checks):
```json
{"status": "ok", "version": "1.4.2", "gitSha": "a1b2c3d", "uptime": 86400}
```
- `X-Request-Id` header on every response. Echo client's if provided; generate one if not.
- Datadog dashboard per service: request rate, latency (p50/p95/p99), error rate, upstream health.

---

## Idempotency & Concurrency

- Non-idempotent `POST` endpoints should support `Idempotency-Key` header. Same key = return original response, do not re-execute. Keys expire after 24 hours.
- `GET`, `PUT`, `DELETE` are inherently idempotent — no special handling needed.
- For resources with concurrent writers, support `If-Match` + ETags (optional, only when concurrent modification is a real problem).

---

## Async / Long-Running Operations

When an operation takes >5 seconds, return `202` with a status resource:
```
POST /api/v1/policies/123/evaluation
-> 202 Accepted
-> Location: /api/v1/operations/op_789
-> Retry-After: 5

{"operationId": "op_789", "status": "processing", "statusUrl": "/api/v1/operations/op_789"}
```

Poll the status resource:
```json
{"operationId": "op_789", "status": "completed", "result": {...}, "completedAt": "..."}
```

Status values: `processing`, `completed`, `failed`. Errors on failure use the standard RFC 9457 shape inside the operation resource.

> **Design note:** Polling is simpler to implement; waiting (keeping the connection open) is faster for clients and uses fewer compute resources but requires the server to manage open connections. The Confluence standard uses polling. Only consider waiting-style if polling proves insufficient.

---

## CORS

- Never `Access-Control-Allow-Origin: *` on authenticated APIs. Allowlist specific origins.
- Expose useful headers: `Access-Control-Expose-Headers: X-Request-Id, Retry-After, Deprecation, Sunset`

---

## Quick Reference

| Concern | Convention |
|---------|-----------|
| URL casing | `kebab-case` |
| JSON keys | `camelCase` |
| Query params | `camelCase` |
| Enum values | `snake_case` |
| Error shape | RFC 9457 (`application/problem+json`) |
| Resource names | Plural nouns |
| Dates | ISO 8601, UTC for timestamps |
| IDs | Strings in JSON; Crockford Base32 + check digit preferred |
| Money | Integer amount + currency object |
| Booleans | `true`/`false` only; positive naming |
| Empty collection | `200` with `{"data": []}` |
| Created | `201` + resource + `Location` header |
| Deleted | `204` no body |
| Validation error | `422` + `type: .../validation-failed` + `errors` array |
| Unsupported method | `405` + `Allow` header |
| Auth failure | `401` (no creds) / `403` (wrong role) |
| Collection envelope | `{"data": [...]}` |
| Pagination | `{"data": [...], "pagination": {...}}` |
| PATCH semantics | JSON Merge Patch (RFC 7396) |
| Actions | `POST /resources/{id}/action-noun` |
| Versioning | `/api/v1/` in URL path |
| Standard methods | Side-effect free |
| Boolean naming | Positive phrasing |
| String encoding | UTF-8, NFC normalized |
| API docs | `GET /docs` |
| Health check | `GET /health` |
