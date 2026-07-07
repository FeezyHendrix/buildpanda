---
name: writing-backend-code
description: Use when writing, extending or reviewing backend code in packages/backend — new modules, routes, services, repositories, migrations, auth checks, config, errors, email, tests, or server lifecycle.
---

# Writing Backend Code (BuildPanda)

## Overview

Tao-of-Node principles adapted to this repo: **modular monolith grouped by
domain, three layers per module, framework kept out of business logic.**
Fastify is the transport; Knex is the data access; everything in between is
plain functions composed by dependency injection. When in doubt, copy the
shape of `modules/queries/` or `modules/action-items/` — the same anatomy has
shipped 10+ times. The examples below thread one feature (`action-items`,
ID prefix `ai_`) through every layer so the shapes line up end to end.

**Principles that keep the code honest:**
- **DRY** — every rule has exactly one home: HTTP shaping in `routes.ts`,
  business logic in `service.ts`, SQL in `repository.ts`, env in `config`,
  error→response mapping in the error-handler plugin, permissions in
  `lib/authorization.ts`. If you write the same thing twice, one of them is in
  the wrong layer.
- **YAGNI** — build the slice the feature needs, not a scaffold for futures.
  The repo already owns its schema (inline `as const`), config
  (`required`/`optional`), errors (`AppError`), auth helpers, IDs and email.
  Do not pull in a library (TypeBox, env-schema, a test framework, a JWT
  plugin) to re-do something we already have.
- **Clean code** — small factory functions, intention-revealing names, the
  happy path readable top-to-bottom, side effects pushed to the edges.

## Module anatomy (the canonical slice)

```
modules/action-items/
  types.ts          # ActionItemRow (snake_case) + ActionItem (camelCase) + STATUSES as const
  repository.ts     # actionItemRepository(db) -> { listByProject, byId, insert, ... }
  service.ts        # actionItemService(repo) -> { list, get, create, ... } via toActionItem()
  routes.ts         # default FastifyPluginAsync; inline `as const` schemas
  action-items.test.ts
```

Register in `server.ts` and compose the layers in the route plugin — the
composition root is the only place that knows all three layers exist:

```ts
// server.ts
await app.register(actionItemRoutes)

// routes.ts
const actionItemRoutes: FastifyPluginAsync = async (app) => {
  const service = actionItemService(actionItemRepository(app.db))
  app.get("/projects/:projectId/action-items", { schema: listSchema }, async (req) => {
    req.requireAuth()
    assertCanAccessProject(req.projectRoles, req.params.projectId)
    return service.list(req.params.projectId, req.query.status)
  })
}
export default actionItemRoutes
```

No classes — factory functions everywhere. That DI seam (`service(repo)`,
`repository(db)`) is also the test seam: swap a real repo for a fake one with
no mocking framework (see **Testing**).

**One concern per file — nothing else.** Each file in the slice owns exactly
one concern; anything outside that concern belongs in its sibling:

| File | Owns (exclusively) | Must NOT contain |
|---|---|---|
| `types.ts` | Every `interface`, `type` alias, shared `as const` enum array | Runtime logic |
| `repository.ts` | All SQL/Knex — the **only** file that touches `db` | Business rules, DTO mapping, HTTP, email |
| `service.ts` | Business rules, `toX` DTO mapping, side-effect orchestration (email, notifications, cross-module service calls) | `db`/Knex, `request`/`reply`, schemas |
| `routes.ts` | Inline `as const` JSON schemas, `requireAuth()`/`assertCan*`, param plumbing, calling the service | Type declarations, `db`/Knex queries, `sendEmail`, business rules |

A request-body or query shape is still a type — declare it in `types.ts` and
import it, even if only one route uses it. The inline JSON *schemas* are the
one thing that looks like a type but isn't: they're runtime validation values
and stay next to the route.

```ts
// Bad — routes.ts declaring its own type, querying db, sending email
interface UpdateBody { name: string; status: Status }
app.patch("/action-items/:id", { schema }, async (req) => {
  const row = await app.db("action_items").where({ id: req.params.id }).first()  // repository's job
  await sendEmail(row.assignee_email, assignedEmail(row))                        // service's job
})

// Good — routes.ts imports types, delegates everything past auth to the service
import type { UpdateBody } from "./types.ts"
app.patch("/action-items/:id", { schema: updateSchema }, async (req) => {
  req.requireAuth()
  assertCanModifyProject(req.projectRoles, req.params.projectId)
  return service.update(req.params.id, req.body)   // service queries via repo and sends the email
})
```

## Rules

### Layering

HTTP concerns stop at `routes.ts`. Services never see `request`/`reply`;
repositories never hold business rules. `db` is touched by `repository.ts`
only — a `db(...)` call in a route or service is a layering bug, not a
shortcut. Side effects like `sendEmail` fire from the service, never from a
route handler. Cross-module calls go through the other module's *service*,
never its tables. Map rows to DTOs at the service boundary with a `toX`
function; never return a raw row from a route.

```ts
// types.ts — the row is snake_case, the DTO is camelCase
export const STATUSES = ["open", "in_progress", "done"] as const
export type Status = (typeof STATUSES)[number]
export interface ActionItemRow { id: string; project_id: string; due_at: Date | null; status: Status }
export interface ActionItem    { id: string; projectId: string; dueAt: string | null; status: Status }

// service.ts — toActionItem is the single row->DTO mapper
function toActionItem(r: ActionItemRow): ActionItem {
  return { id: r.id, projectId: r.project_id, dueAt: r.due_at?.toISOString() ?? null, status: r.status }
}

export function actionItemService(repo: ActionItemRepository) {
  return {
    async list(projectId: string, status?: Status) {
      return (await repo.listByProject(projectId, status)).map(toActionItem)
    },
    async get(id: string) {
      const row = await repo.byId(id)
      if (!row) throw new NotFoundError("Action item")   // business decision lives here, not in the route
      return toActionItem(row)
    },
  }
}
```

```ts
// Cross-module: call the service, never the table.
// Bad — reaching into another domain's storage
const q = await app.db("queries").where({ id }).first()
// Good — go through its service (its rules and mapping travel with it)
const q = await queryService(queryRepository(app.db)).get(id)
```

### Routes & validation

Every route validates with an inline `as const` JSON schema covering
`params` / `body` / `querystring`, plus a `response` schema. `response` makes
serialization use fast-json-stringify and acts as an output allowlist, so a DTO
can never leak a column you forgot to drop — the schema-level partner to "never
return raw rows". Enums come from the shared `as const` array. ajv-formats is
not registered, so use `pattern`, never `format: "email"` (registering it just
to get `format` would duplicate validation we can already express). Handlers
are happy-path only and `throw` typed errors; the error-handler plugin is the
single place that shapes error responses.

```ts
const listSchema = {
  params: { type: "object", required: ["projectId"],
    properties: { projectId: { type: "string" } }, additionalProperties: false },
  querystring: { type: "object",
    properties: { status: { type: "string", enum: STATUSES } }, additionalProperties: false },
  response: {
    200: { type: "array", items: {
      type: "object",
      properties: {
        id: { type: "string" }, projectId: { type: "string" },
        dueAt: { type: ["string", "null"] }, status: { type: "string", enum: STATUSES },
      },
    } },
  },
} as const

// email: no ajv-formats -> validate with a pattern, not `format: "email"`
const emailField = { type: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" } as const
```

```ts
// Bad — shaping an error by hand inside the handler
app.get("/action-items/:id", async (req, reply) => {
  const item = await service.get(req.params.id)
  if (!item) return reply.code(404).send({ error: "not found" })   // duplicates the error plugin
  return item
})
// Good — throw; the error-handler plugin owns the response shape
app.get("/action-items/:id", { schema: getSchema }, async (req) => {
  req.requireAuth()
  return service.get(req.params.id)   // service throws NotFoundError; plugin renders it
})
```

### Auth (authorization ≠ presentation)

`request.requireAuth()` establishes identity; the helpers in
`lib/authorization.ts` (`assertCanAccessProject`, `assertCanModifyProject`,
`assertCanActAsClient`) decide permission, fed by `request.orgRoles` /
`request.projectRoles`. `user.accountType` is a UI hint — never an
authorization input. Public endpoints (token links, lead forms) skip
`requireAuth()` but must validate strictly and log.

```ts
// Bad — accountType is self-declared; this is not a security boundary
if (req.user.accountType === "company") await service.delete(id)
// Good — permission comes from project participation
app.delete("/projects/:projectId/action-items/:id", { schema: delSchema }, async (req) => {
  req.requireAuth()
  assertCanModifyProject(req.projectRoles, req.params.projectId)   // throws ForbiddenError if not allowed
  await service.delete(req.params.id)
  return { ok: true }
})
```

`requireAuth`, `orgRoles`, `projectRoles`, and `db` are decorators shared
across modules, so they live behind `fastify-plugin` — an encapsulated
`decorate` would not reach sibling route plugins. Add new cross-cutting
decorators the same way and type them via declaration merging.

```ts
import fp from "fastify-plugin"

declare module "fastify" {
  interface FastifyInstance { db: Knex }
  interface FastifyRequest { requireAuth(): AuthUser; projectRoles: ProjectRole[] }
}

export default fp(async function dbPlugin(app) {
  const db = knex(config.db)
  app.decorate("db", db)
  app.addHook("onClose", async () => { await db.destroy() })   // closed on shutdown, not in handlers
}, { name: "db" })
```

### Finance: money is logged, not transacted

BuildPanda is a construction **bookkeeping** system — money never passes through
it. There is no payment processor, gateway, webhook, escrow provider, or bank
integration anywhere, and none may be added. Every financial action is a **record
of a real-world money movement a human made off-platform**, not a transaction the
system performs.

- `modules/finances` is the reference: `deposit` and `releaseMilestone` are **pure
  Knex writes** — they update stored figures (`funds_deposited`, `funds_released`,
  `locked_in_escrow`, `remaining_balance`) with `trx.raw("col + ?")` arithmetic and
  append a `payment_ledger` row. No external call. `.forUpdate()` locks guard record
  consistency, not fund safety.
- `locked_in_escrow` is a **computed/stored number**, not a real escrow account.
  `payment_ledger` (Deposit/Release/Hold) and `finance_events` are **append-only audit
  trails**. Invoices/payment-claims `paid`/`approved` are **recorded statuses**, not
  charges. "Record payment" / "Release" **log**; they never move money.
- When building finance features: model as append-only logs or recorded figures with
  an **actor + timestamp**; treat the record as the source of truth for what a human
  did elsewhere. Never call or import a payment/banking SDK, never add `PAYMENT_*`
  config, never write copy or events implying the system moved money (say "Funded",
  "Recorded", "Logged" — not "Charged", "Paid out", "Transferred").

### Data & migrations

Knex query builder, no ORM. Type rows generically with `db<XRow>("table")`. One
migration per feature, `YYYYMMDD_feature.ts`, with both `up` and `down`. Enum
columns get a raw CHECK via the `check(values)` join helper. IDs come from
`generateId("prefix")` in `lib/ids.ts`.

```ts
// repository.ts — generic row type, no business rules in here
export function actionItemRepository(db: Knex) {
  return {
    listByProject: (projectId: string, status?: Status) =>
      db<ActionItemRow>("action_items")
        .where({ project_id: projectId })
        .modify((q) => { if (status) q.where({ status }) })
        .orderBy("created_at", "desc"),
    byId: (id: string) => db<ActionItemRow>("action_items").where({ id }).first(),
    insert: (row: ActionItemRow) => db<ActionItemRow>("action_items").insert(row),
  }
}

// migrations/20240115_action_items.ts
export async function up(knex: Knex) {
  await knex.schema.createTable("action_items", (t) => {
    t.string("id").primary()                 // generateId("ai_") at the service layer
    t.string("project_id").notNullable().references("id").inTable("projects")
    t.timestamp("due_at")
    t.string("status").notNullable().checkIn(STATUSES)   // CHECK constraint mirrors the as-const enum
    t.timestamps(true, true)
  })
}
export async function down(knex: Knex) {
  await knex.schema.dropTable("action_items")            // never ship up() without down()
}
```

**No N+1 queries.** Never run a query per row in a loop — fetch the parent set
once, collect the ids, then fetch children in a single batched query (`whereIn`)
and stitch in memory. The repo already does this everywhere (e.g.
`updates/repository.ts` `mediaForUpdates(updateIds[])`,
`messaging/repository.ts` `whereIn("message_id", messageIds)`); copy that shape.
Independent queries that don't depend on each other run together with
`Promise.all`. Repository methods that resolve a collection should take an array
(`findByIds(ids)`), not be called once per id by the service.

```ts
// Bad — N+1: one query per task to get its subtasks
const tasks = await repo.listTasks(projectId)
for (const t of tasks) {
  t.subtasks = await repo.subtasksForTask(t.id)   // a query PER task
}

// Good — two queries total: parents, then all children by id, stitched in memory
const tasks = await repo.listTasks(projectId)
const byTask = groupBy(
  await repo.subtasksForTasks(tasks.map((t) => t.id)),  // whereIn("task_id", ids)
  (s) => s.task_id,
)
for (const t of tasks) t.subtasks = byTask.get(t.id) ?? []

// Good — independent reads in parallel
const [board, assignees] = await Promise.all([repo.board(projectId), repo.assignees(projectId)])
```


### Panda AI awareness

The in-app assistant (`modules/panda-ai/agent`) answers project questions by
calling read **tools** — each tool runs one query in `agent/repository.ts` and
returns a small DTO from `agent/tools.ts`; the domains it can read are listed in
the `SYSTEM_PROMPT` in `agent/service.ts`. The assistant can ONLY see data a
tool exposes. So whenever you add or change project-scoped data, ask: **"would a
PM reasonably ask Panda AI about this?"** If yes, wire it in:

1. Add a query to `agent/repository.ts` (project-scoped, mirror the others).
2. Add a `tool(fn(...))` in `agent/tools.ts` returning the minimal useful fields.
3. Mention the new domain in the `SYSTEM_PROMPT` so the model knows it exists.

Skip it for plumbing tables (jobs, events, link/junction, media blobs) and for
data already covered by an existing tool — check `get_*` tools first to avoid
overlap (e.g. milestone payments already live inside `get_finances`). When the
answer is no, leave it to the `navigate` tool. A new user-facing feature that
the assistant cannot read is a gap, not a non-feature.

### Config & integrations

All env access lives in `config/index.ts` behind `required`/`optional`,
hierarchical (`config.mail.token`). Modules import `config`, never
`process.env`. `required` throws at boot when a var is missing, so the process
fails fast instead of 500-ing on first use — the helpers *are* the env schema,
so don't add env-schema to re-validate.

```ts
// config/index.ts
const required = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env ${k}`); return v }
const optional = (k: string, d = "") => process.env[k] ?? d

export const config = {
  port: Number(optional("PORT", "3000")),
  db: { connectionString: required("DATABASE_URL") },   // throws at startup if absent
  mail: { token: optional("MAIL_TOKEN") },              // empty => dev mode (logs instead of sends)
} as const

// Bad — bypasses validation and the single source of truth
const url = process.env["DATABASE_URL"]
// Good
import { config } from "../../config/index.ts"
const url = config.db.connectionString
```

Email goes through `sendEmail` (`lib/mail.ts`) plus a template fn in
`lib/email-templates.ts`. Escape every piece of user input; keep the empty-token
dev-mode path working.

```ts
// lib/email-templates.ts — escapeHtml on ALL interpolated user input
export const inviteEmail = (name: string, link: string) => ({
  subject: "You've been invited",
  html: `<p>Hi ${escapeHtml(name)},</p><p><a href="${escapeHtml(link)}">Open project</a></p>`,
})
// usage: empty MAIL_TOKEN logs instead of sending (dev mode) — don't break that
await sendEmail(to, inviteEmail(user.name, link))
```

### Testing

Two levels, both riding the factory seam — no module mocking, no test-double
framework. Use the built-in `node:test` runner and `assert` (`node --test`),
not Jest or Mocha.

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

// 1) Service unit test: inject a hand-written fake repo. This is what the factory shape is for.
test("get() maps row to DTO and 404s when missing", async () => {
  const row = { id: "ai_1", project_id: "p_1", due_at: null, status: "open" } as ActionItemRow
  const svc = actionItemService({ byId: async (id) => (id === "ai_1" ? row : null) } as any)
  assert.equal((await svc.get("ai_1")).projectId, "p_1")
  await assert.rejects(svc.get("ai_x"), /not found/i)
})

// 2) Route/integration test: real wiring through inject(), no network.
test("GET list returns 200", async () => {
  const app = await buildApp()          // shared helper, logger:false
  await app.ready()
  const res = await app.inject({ method: "GET", url: "/projects/p_1/action-items" })
  assert.equal(res.statusCode, 200)
  assert.ok(Array.isArray(res.json()))
  await app.close()
})
```

Build through a shared `buildApp()`; `await app.ready()` before and
`await app.close()` after. Set `logger: false` in tests. Isolate DB-touching
tests by running each inside a transaction you roll back in teardown, so suites
stay order-independent.

### Server lifecycle

Register `close-with-grace` in `server.ts` so SIGTERM/SIGINT drain in-flight
requests before `await app.close()`. Long-lived connections close in the
`onClose` hook of the plugin that opened them (see the `db` plugin above), never
ad hoc in a handler. Health/readiness endpoints skip `requireAuth()` and stay
dependency-light.

```ts
import closeWithGrace from "close-with-grace"

const app = buildApp()
await app.listen({ port: config.port, host: "0.0.0.0" })

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) app.log.error({ err }, "shutdown triggered by error")
  app.log.info({ signal }, "draining and closing")
  await app.close()                 // onClose hooks (db.destroy, etc.) run here
})
```

### Style

ESM, no build step — keep every file type-strip safe (it runs under
`node --strip-types`). Relative paths, no aliases. Comments explain *why*, never
*what*. Logging is structured: a context object first, no string interpolation,
no bare `console.log` in request paths.

```ts
// Type-strip safe: import type, const-arrays not enums, explicit .ts extensions
import type { Knex } from "knex"
import { STATUSES } from "./types.ts"
// Bad: enum ActionStatus { Open, Done }        // not erasable -> breaks type stripping
// Good: export const STATUSES = ["open","done"] as const

// Bad — unstructured, hard to query, and bare console
console.log(`fetched ${items.length} items for ${projectId}`)
// Good — structured, request-scoped (carries the request id automatically)
req.log.info({ projectId, count: items.length }, "listed action items")
```

## Quick reference

| Need | Use |
|---|---|
| New endpoint group | New module folder + `app.register` in server.ts |
| Declare a type/interface/enum array | `types.ts` only — other files import it |
| Reject bad input | Inline `as const` schema, `additionalProperties: false` |
| Shape the response | `response` schema on the route (allowlist + fast serialize) |
| 4xx/5xx | `throw new BadRequestError/NotFoundError/ForbiddenError(...)` |
| Who is calling | `request.requireAuth()` → `{ id, email, ... }` |
| May they touch this project | `assertCanModifyProject(req.projectRoles, projectId)` |
| Share a decorator across modules | wrap the plugin in `fastify-plugin` + declaration merge |
| New table/column | Dated migration with `up`+`down` + CHECK for enums |
| Env var | Add to `config/index.ts` (`required`/`optional`) + `.env.example` |
| Send email | Template fn in `email-templates.ts` (escape input) → `sendEmail()` |
| Test a route / a service | `app.inject(...)` / call the factory with a fake repo |
| Shut down cleanly | `close-with-grace` in server.ts + `onClose` to close `db` |

## Common mistakes

- Business logic in `routes.ts` "because it's short" — move it to the service
  from the first line (Layering).
- Declaring an `interface` or `type` in `routes.ts`/`service.ts`/`repository.ts`
  "because only this file uses it" — types live in `types.ts`, full stop; the
  other files import them.
- Querying `db` from `routes.ts` or `service.ts` "for a quick lookup" — every
  query goes through `repository.ts`, even one-liners.
- Calling `sendEmail` from a route handler — side effects are orchestrated by
  the service.
- Reaching into another module's tables instead of calling its service.
- N+1 queries — a query per row in a loop instead of one batched `whereIn` (or
  `Promise.all` for independent reads); repository collection methods should take
  an id array, not be called once per id.
- Returning raw rows or omitting the `response` schema — map via `toX` and
  declare the response.
- `format: "email"` in a schema — crashes at startup (no ajv-formats); use
  `pattern`.
- Missing `down()` or the enum CHECK in a migration.
- Interpolating user input into email HTML without `escapeHtml`.
- Authorization by `accountType` — it is self-declared; only org membership and
  project participation grant power.
- `process.env["X"]` in a module instead of extending `config`.
- Adding a library (TypeBox, env-schema, a test framework, a JWT plugin) to
  duplicate the schema/config/error/auth/test primitives the repo already owns
  (YAGNI).
- Mocking modules in tests instead of passing a fake repo into the service
  factory.
- `enum` in `types.ts` instead of an `as const` array — breaks type stripping.
- Closing the DB inside a handler instead of the plugin's `onClose` hook.
- Shipping a user-facing project feature without asking whether Panda AI should
  read it — add an agent tool when a PM would ask about the data (Panda AI awareness).