---
name: writing-backend-code
description: Use when writing, extending or reviewing backend code in packages/backend — new modules, routes, services, repositories, migrations, auth checks, config, errors, or email sending.
---

# Writing Backend Code (BuildPanda)

## Overview

Tao-of-Node principles adapted to this repo: **modular monolith grouped by
domain, three layers per module, framework kept out of business logic.**
Fastify is the transport; Knex is the data access; everything in between is
plain functions composed by dependency injection. When in doubt, copy the
shape of `modules/queries/` or `modules/action-items/` — the same anatomy has
shipped 10+ times.

## Module anatomy (the canonical slice)

```
modules/<feature>/
  types.ts        # XRow (snake_case DB row) + X (camelCase DTO) + enums as const arrays
  repository.ts   # export function xRepository(db: Knex) { return { ...queries } }
  service.ts      # export function xService(repo) { return { ... } } — maps rows→DTOs via toX()
  routes.ts       # default-export FastifyPluginAsync; inline `as const` JSON schemas
```

Register in `server.ts`: `await app.register(xRoutes)`. Routes compose layers:
`const service = xService(xRepository(fastify.db))`. No classes — factory
functions everywhere (DI over mocking; this is what makes services testable).

## Rules

**Layering**
- HTTP concerns stop at `routes.ts`. Services never see `request`/`reply`;
  repositories never contain business rules. Cross-module calls go through the
  other module's *service*, never its tables.
- Map DB rows to domain DTOs at the service boundary: `toX(row: XRow): X`,
  snake_case → camelCase. Never return raw rows from a route.

**Routes & validation**
- Every route validates with an inline `as const` JSON schema:
  `{ schema: { params, body, querystring } }`, `additionalProperties: false`,
  enums from a shared `const STATUSES = [...] as const`.
- ajv-formats is NOT registered — use `pattern`, not `format: "email"`.
- Handlers are happy-path only: `throw new NotFoundError(...)` etc. from
  `lib/errors.ts` (AppError subclasses); the error-handler plugin is the one
  place that shapes error responses. Never `reply.send` an error manually.

**Auth (authorization ≠ presentation)**
- `request.requireAuth()` for identity; `lib/authorization.ts` helpers
  (`assertCanAccessProject`, `assertCanModifyProject`, `assertCanActAsClient`)
  for permission, fed by `request.orgRoles` / `request.projectRoles`.
  `user.accountType` is a UI hint — never use it for authorization.
- Public endpoints (token links, lead forms) simply skip `requireAuth()` and
  must validate strictly + log.

**Data & migrations**
- Knex query builder, no ORM. Generic row types: `db<XRow>("table")`.
- One migration per feature, named `YYYYMMDD_feature.ts`, with `up`/`down`.
  Enum columns get raw CHECK constraints via the `check(values)` join helper.
- IDs: `generateId("prefix")` from `lib/ids.ts` (e.g. `ai_`, `q_`).

**Config & integrations**
- All env access lives in `config/index.ts` (`optional`/`required` helpers,
  hierarchical: `config.mail.token`). Modules import `config`, never
  `process.env`.
- Email: `sendEmail` from `lib/mail.ts` + a template fn in
  `lib/email-templates.ts` (HTML-escape all user input). Empty token = dev
  mode (logs instead of sending) — keep that behavior working.

**Style**
- ESM with explicit `.ts` import extensions; relative paths (no aliases).
- Comments explain *why* (constraints, market context), never *what*.
- Structured logging via `request.log` / `app.log` with context objects —
  no bare `console.log` in request paths.

## Quick reference

| Need | Use |
|---|---|
| New endpoint group | New module folder + `app.register` in server.ts |
| Reject bad input | Inline JSON schema, `additionalProperties: false` |
| 4xx/5xx | `throw new BadRequestError/NotFoundError/ForbiddenError(...)` |
| Who is calling | `request.requireAuth()` → `{ id, email, ... }` |
| May they touch this project | `assertCanModifyProject(scope, ctx)` |
| New table/column | New dated migration with `up`+`down` + CHECK for enums |
| Env var | Add to `config/index.ts` + `.env.example` (with comment) |
| Send email | Template fn in `email-templates.ts` → `sendEmail()` |

## Common mistakes

- Business logic in `routes.ts` "because it's short" — it grows; move it to
  the service from the first line.
- Reaching into another module's tables — call its service.
- `format: "email"` in a schema — crashes at startup (no ajv-formats).
- Forgetting `down()` or the CHECK constraint in migrations.
- Interpolating user input into email HTML without `escapeHtml`.
- Authorization by `accountType` — it is self-declared; only org membership
  and project participation grant power.
- Writing `process.env["X"]` in a module instead of extending `config`.
