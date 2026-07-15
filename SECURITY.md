# Security Policy

This document describes how BuildPanda protects client data and how to report
a vulnerability. It reflects the system as built; where a control is an
operational requirement (something to configure in the deployment, not in
code), it is called out explicitly.

## Reporting a vulnerability

Email **security@buildpanda.io** with a description, reproduction steps, and
impact. Please do not open public GitHub issues for security reports. We aim to
acknowledge within 2 business days and to provide a remediation timeline after
triage. We will credit reporters who request it once a fix has shipped.

Do not run automated scanners against the production hosts without prior
written authorization.

## Architecture at a glance

- **Transport**: Fastify 5 (JSON API). TLS is terminated at the edge (Railway).
- **Auth**: Better Auth (server-side sessions in PostgreSQL, organization plugin
  for multi-tenancy).
- **Data**: PostgreSQL via Knex (parameterized queries). Object storage on
  S3/MinIO with presigned URLs.
- **Jobs**: Redis-backed queue (BullMQ); inline fallback when Redis is absent.

## Identity & authentication

- Passwords are hashed by Better Auth (scrypt); the application never stores or
  logs raw passwords. Minimum length is 8 characters.
- Email verification is required before account use; password-reset and
  verification tokens expire in 1 hour.
- Sessions live server-side in Postgres with a 7-day expiry and rolling refresh.
- Session cookies are `Secure`, `SameSite=None`, `Partitioned` (HTTPS-only,
  cross-site for the SPA/admin origins).
- Google OAuth is supported as an optional social provider.
- Platform administrators are an explicit email allowlist (`ADMIN_EMAILS`); there
  is no hardcoded admin account. Support impersonation, when used, is time-boxed
  to one hour.

## Authorization (tenant isolation)

Access is gated on every route by two independent layers:

1. **Organization roles** — each user belongs to a company (organization).
   Permissions are resource→action scoped (e.g. `finances: view|manage|approve`,
   `documents: view|upload|delete`) via Better Auth's access-control matrix.
2. **Per-project participant roles** — external stakeholders (clients,
   homeowners) are granted access to a single project via `project_participants`,
   never to the wider organization.

Enforcement helpers (`lib/authorization.ts`, surfaced as request guards in
`plugins/auth-context.ts`) are applied in handlers as
`req.requireAuth()` + `assertCanAccessProject(...)` /
`requireProjectWrite(...)` / `requireProjectPermission(...)`. Read, write, and
delete are separately privileged: `viewer` cannot write, and only project
owners or org owners/admins can delete. `user.accountType` is a UI hint and is
never an authorization input.

## Input handling & output safety

- Every route validates `params` / `body` / `querystring` against a strict JSON
  schema (`additionalProperties: false`).
- `response` schemas act as an output allowlist (fast-json-stringify), so a
  response can never leak a column that was not explicitly declared.
- SQL is built exclusively through Knex, which parameterizes values; no
  string-concatenated SQL.

## HTTP hardening

- **Security headers** via `@fastify/helmet`: a restrictive `default-src 'none'`
  CSP (this is a JSON API, not an HTML origin), `frame-ancestors 'none'`,
  cross-origin resource policy for the SPA, and HSTS (`includeSubDomains`,
  `preload`) in production.
- **Rate limiting** via `@fastify/rate-limit`: a global per-IP baseline on all
  requests, with tighter caps on unauthenticated, abuse-prone routes
  (file-share/RFI/proposal token links and the public lead form). The
  `/api/auth/*` endpoints are throttled by Better Auth's own limiter (sign-in,
  sign-up, and forget-password are capped harder) to avoid double-counting.
- `trustProxy` is enabled so the limiter and geo-IP key off the real client
  address forwarded by the edge proxy, not the proxy itself.
- **CORS** is a strict origin allowlist (`CORS_ORIGIN`), shared with Better
  Auth's trusted origins.

## Secrets

- Secrets are supplied via environment variables only; none are committed.
  `.env` is gitignored and `.env.example` ships placeholders.
- `BETTER_AUTH_SECRET` is **required in production** — the server refuses to boot
  with an empty signing secret.

## Logging & privacy

- Logs are redacted at the serializer level: authorization/cookie headers,
  `set-cookie`, and common secret keys (`password`, `token`) are replaced with
  `[redacted]` regardless of what a handler logs.
- Error monitoring (Sentry) is enabled only in production and only when a DSN is
  configured.

## Encryption at rest

- **Object storage**: server-initiated uploads request SSE-S3 (AES256) when
  targeting real S3. Presigned client uploads rely on **bucket default
  encryption**, which must be enabled on the bucket (operational requirement).
  Local MinIO defaults SSE off because it requires a separate KES/KMS.
- **Database**: relies on the platform's volume encryption (Railway-managed
  Postgres). Verify volume encryption is enabled for the production database.
- Application-layer field-level encryption is intentionally not used at this
  stage: it would break indexing/search on PII columns for limited benefit over
  infrastructure encryption. This decision should be revisited if a compliance
  regime (e.g. handling payment data directly) requires it.

### Operational checklist (production)

- [ ] `BETTER_AUTH_SECRET` set to 32+ random characters.
- [ ] `CORS_ORIGIN` includes every production frontend origin (scheme + host, no
      trailing slash).
- [ ] `REDIS_URL` set so rate-limit counters are shared across instances.
- [ ] S3 bucket has default encryption enabled (covers presigned uploads).
- [ ] Postgres volume encryption verified with the hosting provider.
- [ ] Object storage bucket is private (no public read).

## Data handling & compliance posture

- **Data classification**: we store client PII (names, emails, phone numbers),
  project records, financial figures, and uploaded documents.
- **Data minimization**: only fields needed for the product are collected;
  request schemas reject unknown properties.
- **Tenant isolation**: client data is partitioned by organization and project
  as described above; cross-tenant access is denied by default.
- **Subject requests (GDPR/CCPA)**: access, export, and deletion requests are
  handled on request to security@buildpanda.io. (A self-service export/delete
  flow is not yet automated.)
- **Subprocessors**: hosting/database (Railway), object storage (S3-compatible),
  transactional email (SendByte), error monitoring (Sentry), and the configured
  LLM provider for AI features. Client data is shared with these only as needed
  to operate the service.
- **Retention**: records persist for the life of the account unless deletion is
  requested. Shared file links support explicit expiry and revocation.

This posture is a living document and will be expanded as formal compliance
(e.g. SOC 2) is pursued.
