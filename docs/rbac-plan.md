# BuildPanda RBAC: Audit & Concrete Build Plan

_Authored 2026-06-13. Based on an exhaustive audit of every backend route and frontend action (247 findings: 4 critical, 40 high, 37 UX gaps), synthesized and adversarially reviewed across three lenses (security, model-coherence, UX)._

---

## TL;DR

The RBAC shipped so far covers exactly **two of ~14 resources** (`proposals`, `leads`). The entire construction suite — the bulk of the app — has **no resource-action enforcement**: writes are gated only by a coarse "is this user owner/admin/member?" check (`viewer` excluded), and several routes have **no authorization at all**. The frontend gates nothing outside the sales pages.

The fix is one coherent permission lattice with a single source of truth, enforced by one backend primitive and mirrored on the frontend, rolled out in four phases that lead with **closing the security holes** before adding granularity and polish.

Two facts that reshape the work:
- **better-auth 1.5.6 already has a permission engine** (`has-permission.mjs`) that merges static roles with dynamic custom roles. We should drive the runtime off it / off the same table — not maintain a parallel hand-written table.
- **Team management already exists and works** (`dashboard/settings/team.tsx`: invite, change role, remove, custom-role builder, gated to owner/admin). The UX gap is that it's undiscoverable and its custom-role toggles configure permissions the backend never enforces — i.e. the Role Builder currently lies.

---

## 1. How authorization works today — three uncoordinated systems

All three are resolved per-request in `packages/backend/src/plugins/auth-context.ts` (preHandler, lines 94–133):

| Plane | Roles | Storage | Guards |
|---|---|---|---|
| **Org RBAC** (better-auth org plugin) | `owner` / `admin` / `member` / `viewer` + custom | `member` table → `request.orgRoles` | `requireOrgScope()` (membership only), `requireOrgPermission(resource, action)` |
| **Project-participant** (`lib/authorization.ts`) | `client` / `architect` / `inspector` / `guest` | `project_participants` → `request.projectRoles` | `assertCanAccessProject` (read), `assertCanModifyProject` (write; `WRITE_ROLES={owner,admin,member}`), `assertCanActAsClient` |
| **Platform admin** | global `user.role==='admin'` | `user` table | `requireAdmin()`, `ADMIN_EMAILS` allowlist |

These never compose into a single answer to "can user U do action A on resource R in project P." `computeAccess()` (`participants/index.ts:108`) produces a `capabilities` object meant to drive the UI — but the frontend fetches it and **throws it away** (`project-layout.tsx:33` discards it; the Outlet context at `:68` carries only `{ project }`).

### The core problems (all verified in source)

1. **Statement-vs-runtime drift — the central rot.** `lib/permissions.ts` declares a rich `statement` (project, finances, schedule, documents, inspections, materials, contractors, dailyLog, updates, messages, proposals, leads) and full better-auth role objects for all of them — but the runtime `ROLE_PERMISSIONS` table that `hasPermission()` actually reads contains **only `proposals` and `leads`**. All 15 `requireOrgPermission` call-sites are in `proposals/` and `leads/`. The construction RBAC is decorative.
2. **Write-role substitutes for real RBAC.** 21 construction modules gate writes via `assertCanModifyProject` → a binary owner/admin/member check. **A `member` is identical to an `owner`** for every construction mutation: delete documents, release escrow, approve invoices, invite/remove people. The promised `finances:approve` owner-only segregation is never enforced.
3. **Custom roles are inert and the Role Builder lies.** `dynamicAccessControl` is on (`auth.ts:202`) and owners can build granular roles ("site supervisor: schedule, not finances"), but `hasPermission()` only reads the static four-name table and `WRITE_ROLES` doesn't include custom names — so a custom-role user is silently read-only on construction, and the configured restrictions do nothing.
4. **Frontend has almost no authz.** `AbilityProvider` mounts only in `SalesLayout`; `lib/ability.ts`'s `Resource` type is literally `'proposals' | 'leads'`. All 27 construction pages render every create/edit/delete/release control to every role. There's no toast system; the axios interceptor handles only 401, so **403s fail silently**.

---

## 2. Severity-ranked security findings

### Critical (4)

| # | Where | Problem |
|---|---|---|
| C1 | `users/routes.ts:23` — `DELETE /users/:id` | `requireAuth()` only. **Any authenticated user — a member or even a project guest — can hard-delete any account by id**, including admins. The admin SPA's `/admin/users/:id` is properly gated and blocks self-delete; this duplicate bypasses all of it. `GET /users` + `GET /users/:id` (lines 9, 14) also leak the entire user table (email harvesting). |
| C2 | `finances.tsx`, `milestone-payments.tsx` | Fund Project, **Release escrow funds**, and Raise Dispute render to **every** participant (viewer, architect, inspector, guest). Release is gated only by workflow status, never by role. Moving contractor money is exposed to read-only stakeholders. |
| C3 | `people.tsx` | Invite-to-project and Remove-participant render unconditionally. This **controls who else can see the project** — and `capabilities.canManageParticipants` exists for exactly this but is never read. |
| C4 | Role Builder (`team.tsx`) | Owners configure finances/schedule/documents restrictions the backend never enforces → **false sense of security** baked into a shipped feature. |

### High (selected from 40)

- **~11 cross-tenant read leaks**: project-scoped GETs that call `service.listByProject(params.id)` with no `assertCanAccessProject`. Any logged-in user from any tenant reads another tenant's data by guessing a project id: `budget` (`budget/routes.ts:100`), `finances` (`:75`), `invoices` (`invoices:100`), finance disputes (`finances:163`), `daily-logs` (`:67`, `:80`), `inspections` (`:76`), `documents` (`:86`, `:95`), `risk-factors` (`risks:47`), `updates` (`:101`, `:178`), `activities` (`:106`, `:132`), `team-members` (`:65`).
- **Money mutations under-gated** (any member, no approve segregation): escrow release (`finances:146`), invoice approve/mark-paid via free-text status field (`invoices:109`, `:119`), record/delete payment (`invoices:138`, `:155`), deposits (`finances:84`).
- **`PATCH /org-profile`** is `requireOrgScope()` only → any member/viewer rewrites tax/currency defaults **and the contactEmail that receives client proposal responses**.
- **`POST /projects`** is `requireAuth()` only → an org `viewer` can create org-scoped projects (no `requireOrgPermission('project','create')`).
- **`GET /search`** scopes by `owner_id = userId OR owner_id IS NULL` → leaks orphaned cross-tenant projects **and** hides the user's own org projects.
- **Public proposal links** never check `share_token_expires_at` → expired links still serve pricing and accept decisions.
- **Project invite accept** (`participants/index.ts:295`) doesn't verify `session.email === invite.email` → a forwarded link grants the wrong account access.
- **Comment endpoints** (`approvals:158`, `change-requests:157`, `queries:150`, `action-items:156`) use `assertCanAccessProject` (membership) → a `viewer` can write comments though excluded from writes everywhere else.

---

## 3. Target model — one lattice, three planes that compose

### Planes (how the three systems relate)

- **Platform-admin = separate plane (break-glass).** `user.role==='admin'` is checked first and short-circuits. It is **not** a value in the org lattice and is never reachable from the company/project SPA flows.
- **Org-role = baseline capability plane.** `owner > admin > member > viewer` + custom roles define what a company user can do across **all** resources via one resource×action map. Source of truth for company-side authz.
- **Participant-role = external-stakeholder overlay.** `client/architect/inspector/guest` grant a **scoped, additive** capability set on **one** project, on top of "no org access." A homeowner client has **no `member` row** — the two dimensions are disjoint.

**Effective permission** (one function answers everything):

```
isPlatformAdmin
  ? ALLOW
  : assertCanAccessProject(project)  // tenant gate first
    && ( orgPerms(orgRoles.get(project.organization_id))   // bound to THIS project's org
       ∪ participantPerms(projectRoles.get(project.id)) )  // union, not winner-takes-all
       .allows(resource, action)
```

The union matters: a user who is org `viewer` **and** project `client` gets viewer's read breadth **plus** the client's approval-sign-off overlay.

### Single source of truth (and how to make it real on this stack)

Create a **data-only** shared module — plain typed objects, **zero** better-auth import — consumable by both packages:

```ts
// packages/shared/src/permissions.ts   (real workspace package, no framework deps)
export const STATEMENT = { project, finances, schedule, documents, inspections,
  materials, contractors, dailyLog, updates, messages, proposals, leads,
  orgProfile, participants, teamMembers } as const;
export const ROLE_PERMISSIONS:        Record<BuiltinRole,    Partial<Record<Resource, Action[]>>> = { owner, admin, member, viewer };
export const PARTICIPANT_PERMISSIONS: Record<ParticipantRole, Partial<Record<Resource, Action[]>>> = { client, architect, inspector, guest };
```

- **Backend** generates the better-auth `ac`/`roles` from this table (`toAcRole()`), so the `statement` becomes load-bearing. The better-auth import stays backend-side only.
- **Frontend** imports the same data module for `buildAbility()`.
- **Drift eliminated by construction**: one table, three consumers (better-auth AC, backend runtime, frontend ability). A CI assertion checks the generated AC for org-management keys (`organization`/`member`/`invitation`/`team`/`ac`) byte-equals today's statements so org invite/role-change flows don't silently break.

> Reject the "re-export a backend file to the frontend" shortcut — it's the re-copy path that reintroduces drift. Commit to the data-only package.

### Use better-auth's own engine, don't reinvent it

better-auth 1.5.6 ships `has-permission.mjs`, which already merges the static `roles` (wired at `auth.ts:201`) with dynamic `organizationRole` rows (custom roles, permissions stored as JSON). **Delete the hand-rolled `ROLE_PERMISSIONS` runtime lookup** and drive enforcement off the same table better-auth uses — this gets correct custom-role resolution for free and kills the drift permanently.

### Custom roles are the primary granularity mechanism (resolved decision)

The four built-in roles (`owner/admin/member/viewer`) are **sensible defaults, not the ceiling**. Real granularity comes from **org-defined custom roles**: an org creates a role, picks exactly which resource×action permissions it grants, and assigns it to a member. This is already built end-to-end and just needs enforcement turned on:

- **Storage** — `organizationRole` table (migration `20260604`): `{ organizationId, role, permission(JSON) }`, unique per `(org, role)`.
- **Authoring** — `role-builder-dialog.tsx`: an owner/admin names a role and toggles per-resource actions sourced from `statement`, then `createRole`.
- **Assignment** — `dashboard/settings/team.tsx`: invite/assign a member to any built-in (except `owner`) **or** custom role via single-select (`assignableRoles`), change role, remove, delete role — all gated to owner/admin.

What this changes about the plan:
- **"Can a `member` release escrow / approve invoices?" stops being a hard policy choice.** The built-in `member` ships with `finances:approve` **off** (safe default); an org that wants finance approvers creates a `finance-approver` role with `finances:[view,manage,approve]` and assigns it. Same pattern for documents-delete, participant management, etc. Built-in roles set the baseline; custom roles override per-org. Most of §7's "what exactly can `member` do" questions collapse into "pick the default; orgs tune via custom roles."
- **Enforcement is the whole value.** Phase 2 making custom roles load-bearing is no longer a side-fix — it is the centerpiece. Until the backend reads `organizationRole.permission` (and the frontend mirrors it), every custom role an org builds is silently inert (the current state).

Two implementation gotchas to design for:
1. **Custom roles are allow-lists from zero.** A role with only `{schedule:[view,manage]}` grants *only* that — the holder couldn't even view the project. The Role Builder must seed a baseline (at minimum `view` on the resources a role touches, or an always-on "Project access" baseline) so a custom role isn't accidentally unusable, and show a live permission summary so the author sees exactly what they're granting.
2. **One role per member today.** The member role is a single field and assignment is single-select. To grant "finance approval **and** scheduling," the org makes one role with both. Stacking multiple roles per member (effective perms = union of role sets) is a deliberate future extension, out of scope unless requested.

### Resolve sync-vs-async cleanly (the key architectural decision)

better-auth's `hasPermission` is **async** (it reads custom roles from the DB). But `requireOrgPermission`/`assertProjectPermission` are called on hot paths and want to stay synchronous pure lookups.

**Solution:** the preHandler already does one DB read for `orgRoles`. Extend it to resolve the caller's **effective permission map** for the active org **once** (static role perms ∪ matching custom `organizationRole` perms) and stash it on `request.orgPermissions: Map<Resource, Set<Action>>`. Guards then stay synchronous lookups against the pre-resolved map — **no per-route DB hit, no async guard signature churn.** This is what makes the "pure composition function" framing actually buildable.

### Connecting `hasPermission` to org + custom-role permissions (implementation spec)

This is the piece that makes the Role Builder real. Today `hasPermission()` reads a dead 2-resource table and ignores both the rich built-in role objects and every custom role. The fix wires the runtime to the **same role objects better-auth already uses**, merged with custom-role rows exactly the way better-auth does it.

**What's verified in the installed better-auth (1.5.6):**
- The static `roles` objects in `lib/permissions.ts` (`owner/admin/member/viewer`) already carry full construction permissions (`constructionFull`/`constructionContributor`/`constructionReadOnly`) — they are simply never consulted at runtime. Connecting = start reading them.
- `organizationRole.permission` is stored as JSON of shape **`Record<resource, action[]>`** (`has-permission.mjs:19` parses it with `z.record(z.string(), z.array(z.string()))`).
- better-auth's merge rule (`has-permission.mjs:24-26`): for each custom row, `merged = { ...acRoles[role]?.statements }` then union the JSON actions per resource. So a custom role named like a built-in **extends** it; a brand-new custom name starts from `{}` — confirming the **allow-list-from-zero** gotcha in better-auth's own code.
- The member role field is **comma-split into multiple roles** at the engine level (`permission.mjs:9` iterates roles), even though our assignment UI is single-select. The resolver should split on `,` to stay forward-compatible.

**The connection (preHandler pre-resolve → sync guards):**

1. In `lib/permissions.ts`, add a resolver that mirrors better-auth's merge so our runtime and better-auth never diverge:

   ```ts
   export type PermissionMap = ReadonlyMap<string, ReadonlySet<string>>; // resource -> actions
   const BUILTIN = new Set(Object.keys(roles)); // owner/admin/member/viewer

   /** Effective permissions for a member's role(s) on one org. Mirrors better-auth has-permission.mjs. */
   export function resolvePermissionMap(
     roleField: string,                                        // member.role, e.g. "member" or "finance-approver"
     customRows: { role: string; permission: string }[],      // organizationRole rows for that org
   ): PermissionMap {
     const merged = new Map<string, Set<string>>();
     const customByName = new Map(customRows.map((r) => [r.role, r.permission]));
     for (const name of roleField.split(",").map((s) => s.trim()).filter(Boolean)) {
       // 1) static statements for built-in roles (the rich construction perms already defined)
       const statics = (roles as Record<string, { statements: Record<string, string[]> }>)[name]?.statements ?? {};
       for (const [res, actions] of Object.entries(statics))
         actions.forEach((a) => (merged.get(res) ?? merged.set(res, new Set()).get(res)!).add(a));
       // 2) merge the custom-role JSON for the same name (allow-list from zero for new names)
       const json = customByName.get(name);
       if (json) {
         const parsed = JSON.parse(json) as Record<string, string[]>;
         for (const [res, actions] of Object.entries(parsed))
           actions.forEach((a) => (merged.get(res) ?? merged.set(res, new Set()).get(res)!).add(a));
       }
     }
     return merged;
   }

   export function mapAllows(map: PermissionMap, resource: string, action: string): boolean {
     return map.get(resource)?.has(action) ?? false;
   }
   ```

2. In `plugins/auth-context.ts` preHandler, after building `orgRoles`, resolve effective permissions for every org the user belongs to in **one** extra query, and stash them. Querying all the user's orgs at once covers both `requireOrgPermission` (active org) and `assertProjectPermission` (the project's org, which may differ):

   ```ts
   const orgIds = rows.map((r) => r.organizationId);
   const customRows = orgIds.length
     ? await fastify.db("organizationRole").whereIn("organizationId", orgIds).select("organizationId", "role", "permission")
     : [];
   const byOrg = Map.groupBy(customRows, (r) => r.organizationId); // or manual group
   request.orgPermissions = new Map(
     rows.map((r) => [r.organizationId, resolvePermissionMap(r.role, byOrg.get(r.organizationId) ?? [])]),
   ); // ReadonlyMap<orgId, PermissionMap>
   ```

   Skip the `organizationRole` query when none of the user's roles are custom (all in `BUILTIN`) to avoid the read on the common path.

3. Rewrite `requireOrgPermission` to consult the resolved map instead of the dead table:

   ```ts
   function requireOrgPermission(this: FastifyRequest, resource: string, action: string) {
     if (!this.user) throw new UnauthorizedError();
     const orgId = this.activeOrganizationId;
     if (!orgId || !this.orgRoles.has(orgId)) throw new ForbiddenError("No active organization");
     const perms = this.orgPermissions.get(orgId);
     if (!perms || !mapAllows(perms, resource, action))
       throw new ForbiddenError(`Your role does not allow you to ${action} ${resource}`);
     return orgId;
   }
   ```

   `assertProjectPermission` (the project-scoped helper) reads `ctx.orgPermissions.get(project.organization_id)` for the org half of its union, then ORs the participant overlay.

**Effects of this one change:** built-in construction permissions become load-bearing (`constructionFull`/`Contributor`/`ReadOnly` finally enforced); every custom role an org builds is honored at runtime; the dead 2-resource `ROLE_PERMISSIONS` table is deleted; and because the resolver mirrors better-auth's merge, the better-auth org endpoints (`/api/auth/*`) and our own guards agree. The old pure `hasPermission(role, resource, action)` helper is removed — nothing should call a role-name-only check anymore, since custom roles can't be evaluated from a name alone.

> **Alternative considered:** call better-auth's own async `hasPermission` (`auth.api`) per guard. Rejected for hot-path latency and async-signature churn across ~21 modules; the pre-resolve approach reuses better-auth's exact merge logic without the per-route await.

### Backend enforcement primitives

1. **`requireOrgPermission(resource, action)`** — already exists; now reads `request.orgPermissions`, covering **all** resources. Used by org-scoped non-project routes (proposals, leads, org-profile, search, **project create**).
2. **`assertProjectPermission(project, ctx, resource, action)`** — NEW unified helper in `authorization.ts`: platform-admin bypass → `assertCanAccessProject` (tenant gate) → `union(orgPerms(orgRole on project.org), participantPerms(participantRole on project.id))`. Replaces the ~21 `assertCanModifyProject` call-sites. `assertCanModifyProject`/`assertCanActAsClient` become thin wrappers during migration, then deleted.
3. **Global default-deny preHandler** — method-aware allowlist; any route not explicitly public requires `request.user`. Structurally prevents the next forgotten-guard leak (the root cause of C1 and the `/team-members` leak).

### Frontend mirror

- `lib/ability.ts` imports the shared `Resource`/`Action` types + both permission maps. `buildAbility(orgRole, participantRole, isPlatformAdmin)` implements the **same union rule**; custom roles resolved via `useRoles()`.
- **Mount `AbilityProvider` at app root** (above both `SalesLayout` and `ProjectLayout`). Add a **`ProjectAbilityProvider`** in `project-layout.tsx` combining org role + participant role + `GET /projects/:id/access` capabilities, and **thread it through the Outlet context** (`{ project, ability, capabilities }`).
- **Hide-vs-disable convention** (documented once, applied across all 27 pages): **disable + tooltip** ("Requires owner/admin") for actions another role in the same org could perform; **hide** for actions structurally unavailable to any role the user could hold (participant-only actions for staff, admin-plane actions).
- **403 feedback**: backend `ForbiddenError` carries a human-readable `reason` ("Your role (viewer) cannot release escrow; requires finances:approve"); add a toast provider and extend the axios interceptor to surface `reason` on 403 (currently only 401 handled). Reconcile with existing inline dialog errors so role-management dialogs don't double-message.

---

## 4. Role × Resource × Action matrix

`✅` allow · `❌` deny · `*` = confirm (defaults shown are the recommended starting policy).
This matrix is the **built-in-role default**. Any org can grant a tighter or broader set by minting a custom role (e.g. a `member`-like role that adds `finances:approve`) and assigning it — so the `*` cells are starting defaults, not hard limits.
**Invariant: Phase 2 must not remove any read currently granted by `assertCanAccessProject`** — `view` is preserved broadly; only writes tighten.

### Construction & project resources (org roles)

| Resource | Action | owner | admin | member | viewer |
|---|---|:--:|:--:|:--:|:--:|
| project | view / create / update | ✅ / ✅ / ✅ | ✅ / ✅ / ✅ | ✅ / ✅ / ✅ | ✅ / ❌ / ❌ |
| project | delete | ✅ | ✅ | ❌ | ❌ |
| finances | view / manage | ✅ | ✅ | ✅ | view-only |
| finances | **approve** (release escrow, approve/pay invoice) | ✅ | ✅ | ❌* | ❌ |
| schedule (activities/stages/key-dates) | view / manage | ✅ | ✅ | ✅ | view-only |
| documents | view / upload | ✅ | ✅ | ✅ | view-only |
| documents | delete | ✅ | ✅ | ❌* | ❌ |
| inspections | view / request | ✅ | ✅ | ✅ | view-only |
| inspections | manage (edit/delete) | ✅ | ✅ | ✅* | ❌ |
| materials / contractors | view / manage | ✅ | ✅ | ✅ | view-only |
| dailyLog | view / create | ✅ | ✅ | ✅ | view-only |
| updates | view / post | ✅ | ✅ | ✅ | view-only |
| messages | view / send | ✅ | ✅ | ✅ | view-only |
| participants | view | ✅ | ✅ | ✅ | ✅ |
| participants | manage (invite/remove/re-role) | ✅ | ✅ | ❌* | ❌ |
| teamMembers (contacts roster) | view / manage | ✅ | ✅ | ✅ | view-only |
| orgProfile | view / manage | ✅ | ✅ | view-only | view-only |
| comments (approvals/queries/updates/action-items) | post | ✅ | ✅ | ✅ | ❌* |

Explicit `view` rows exist for **every** project-scoped resource (action-items, approvals, queries, change-requests, risks, key-dates, comments, participants, team-members) so gating reads through `assertProjectPermission(R,'view')` never silently strips a read.

### Sales / pre-construction (org roles) — unchanged from current

| Resource | Action | owner | admin | member | viewer |
|---|---|:--:|:--:|:--:|:--:|
| proposals | view / create·update·send | ✅ | ✅ | ✅ | view-only |
| proposals | delete / convert | ✅ | ✅ | ❌ | ❌ |
| leads | view / create·update | ✅ | ✅ | ✅ | view-only |
| leads | delete | ✅ | ✅ | ❌ | ❌ |

### Org-management (better-auth AC — verify admin parity)

| Resource | Action | owner | admin | member | viewer |
|---|---|:--:|:--:|:--:|:--:|
| organization | update / delete | ✅ | ❌ | ❌ | ❌ |
| member (org) | invite / remove / set-role | ✅ | ✅* | ❌ | ❌ |
| ac (custom roles) | create / update / delete | ✅ | ✅ | ❌ | ❌ |

`*` Verify better-auth permits `admin` (not only `owner`) to `set-role`/`invite`/`remove` — `team.tsx`'s `canManage=(owner||admin)` assumes it. If better-auth restricts to owner, either align the UI to owner-only or extend the AC, else admins see a role `<select>` that 403s silently.

### Participant overlay (external stakeholders — additive, single project)

| Resource | Action | client | architect | inspector | guest |
|---|---|:--:|:--:|:--:|:--:|
| (all accessible resources) | view | ✅ | ✅ | ✅ | ✅ curated |
| approvals | decide (sign off) | ✅ | ❌ | ❌ | ❌ |
| queries | raise | ✅ | ✅ | ❌ | ❌ |
| finances | dispute | ✅ | ❌ | ❌ | ❌ |
| inspections | request | ❌ | ❌ | ✅ | ❌ |
| changeRequests | decide | ✅* | ❌ | ❌ | ❌ |
| comments | post | ✅ | ✅ | ✅ | ❌ |

---

## 5. Build phases

**Phase-sequencing rule (UX-critical):** a page's frontend gating (Phase 3) must ship in the **same release** as the backend enforcement (Phase 1/2) for that resource — otherwise a user hits a backend 403 with a still-visible button (inverted dead-end). Either co-release per resource or feature-flag backend enforcement until the matching gate lands.

### Phase 1 — Stop the bleed (security containment, no model refactor)

**Backend:**
- Gate `DELETE /users/:id`, `GET /users`, `GET /users/:id` behind `requireAdmin()` — **or delete these duplicate routes** entirely (the admin SPA already covers user management). _(C1)_
- Add a **method-aware** global default-deny preHandler. Public allowlist: `GET /api/auth/*` (early-return **before** the auth requirement, preserving the existing line-97 return), `GET /healthz`, `GET /static/*`, `GET /proposals/public/*`, `GET /project-invites/:token`, `POST /leads/consultation`. **`POST /project-invites/:token/accept` is NOT public** (requires auth). Smoke test: every public route unauthenticated → expected; one guarded route unauthenticated → 401.
- Fix the ~11 cross-tenant read leaks: load the project + `assertCanAccessProject(scope, {userId, orgRoles, projectRoles})` — **pass `projectRoles`** — before the service call (mirror `key-dates/index.ts`). This simultaneously fixes the homeowner/client 403s on documents/materials/permits reads.
- Gate `PATCH /org-profile` → `requireOrgPermission('orgProfile','manage')` (owner/admin).
- Gate `POST /projects` → `requireOrgPermission('project','create')` (owner/admin/member; viewer denied). **Org-scoped, not project-scoped.**
- Rescope `GET /search` to mirror `assertCanAccessProject` (owner OR org membership OR participant); drop the null-owner leak.
- Public proposals: enforce `share_token_expires_at` on GET and `POST /respond`; return an `expired` state.
- `POST /project-invites/:token/accept`: assert `session.user.email === invite.email`; add a smoke test that a wrong-email authenticated user gets 403.
- Standardize `ForbiddenError` to carry a human-readable, role-aware `reason`.

**Frontend:**
- Add a toast provider at app root; extend `api/client.ts` to surface 403 `reason` (currently only 401 handled).

**Acceptance:** No route reachable without auth except the explicit allowlist. A user unrelated to project P gets 403/404 on every `/projects/P/*` read+write. `DELETE /users/:id` admin-only. Expired share links show expired. Forwarded invites can't be claimed by the wrong account. All legitimate owner/member/client flows still work; participant reads on materials/permits/documents now succeed.

### Phase 2 — Single source of truth + unified enforcement

**Backend:**
- Create the **data-only** shared permission module (full `STATEMENT` + `ROLE_PERMISSIONS` + `PARTICIPANT_PERMISSIONS`). Generate better-auth `ac`/`roles` from it via `toAcRole()`; delete `constructionFull/Contributor/ReadOnly` literals. CI assert: generated org-management AC byte-equals today's.
- **Connect `hasPermission` to org + custom-role permissions** (first task — full spec in §3 "Connecting `hasPermission`…"): add `resolvePermissionMap()` mirroring better-auth's merge, **pre-resolve `request.orgPermissions` once** in the preHandler, rewrite `requireOrgPermission` to read it, and delete the dead 2-resource `ROLE_PERMISSIONS` table. This alone makes built-in construction permissions load-bearing **and** every custom role enforced.
- **Add `index(member.userId)`** (migration) — the per-request `member WHERE userId` lookup currently has no supporting index (the existing unique is org-leading). See §8.
- Add `assertProjectPermission(project, ctx, resource, action)` binding org role to `project.organization_id`; keep `assertCanModifyProject`/`assertCanActAsClient` as thin wrappers initially.
- **Migrate all 21 construction modules explicitly** (no "etc."): `action-items, activities, approvals, budget, change-requests, daily-logs, documents, finances, inspections, invoices, key-dates, materials-equipment, participants, permits, projects, queries, risks, stages, team-members, updates, panda-ai`. Per-route money mapping (the dangerous ones, named):

  | Route | Action |
  |---|---|
  | `finances:146` release escrow | `finances:approve` |
  | `invoices:109` create, `:119` update | `finances:manage`; **`finances:approve` if `status∈{Approved,Paid}`** |
  | `invoices:138` record payment, `:155` delete payment | `finances:approve` |
  | `finances:84` deposit, `finances:98/112/132` milestone CRUD | `finances:manage` |
  | `participants` invite/remove | `participants:manage` |
  | `documents` delete | `documents:delete` |

- **Server-enforce the invoice status field**: reject `Approved`/`Paid` in create/update bodies unless caller has `finances:approve` (status is currently a free body enum — route-gating alone is insufficient).
- Migrate the 4 comment routes to the chosen `comments:post` rule; acceptance test viewer is denied (or allowed) consistently across all four.
- Route `POST /finances/.../disputes` through the participant `client` overlay (homeowner can dispute; confirm whether company staff retain on-behalf dispute).
- **Audit the better-auth org-plugin AC** (`inviteMember`/`removeMember`/`updateMemberRole`/org update·delete/`ac` CRUD) against the matrix; test that a `member` cannot `inviteMember`/`updateMemberRole` via the live handler.
- **Migration evidence**: dump distinct `member.role` and `organizationRole` values; produce a current-vs-new effective-permissions diff per role. (Two SELECTs — turns "asserted safe" into "verified safe.")

**Frontend:**
- Point `lib/ability.ts` at the shared module; delete the private 2-resource `ROLE_ABILITIES` and the duplicate frontend `lib/permissions.ts` AC copy. `buildAbility` implements the union rule; custom roles via `useRoles()`.

**Acceptance:** Exactly one table; better-auth AC + backend runtime + frontend ability all import it. `requireOrgPermission('finances','approve')` allows owner/admin, denies member/viewer. A custom role's configured permissions are honored at runtime. Escrow release / invoice approval by a `member` → 403. No duplicate permission file remains. No read currently granted is removed.

### Phase 3 — Gate the UI everywhere

**Backend:**
- `GET /projects/:id/access` (`computeAccess`) derives capabilities from the **same shared table**, so frontend gating matches backend exactly.

**Frontend:**
- Mount `AbilityProvider` at app root; add `ProjectAbilityProvider` in `project-layout.tsx`; thread `{ project, ability, capabilities }` through the Outlet context (update `useProjectContext()` consumers).
- Wrap every construction mutation control in `<Can>` / disable-with-tooltip via `useProjectAbility()`. Priority (critical): `finances.tsx` + `milestone-payments.tsx` (Fund/Release/Dispute), `people.tsx` (Invite/Remove). Then: budget, invoices, key-dates, stages, documents, daily-log, inspections, materials, equipment-requests, permits, approvals (`canDecideApprovals`), change-requests, queries (`canRaiseQueries`), action-items, updates, activities, team, settings (project budget edit → `project:update`), panda-ai (Run analysis — cost-bearing).
- Gate sales gaps uniformly: `leads.tsx` status select + notes, `boq-tab`, `plans-tab`, `messages-tab`, `sales/settings.tsx` (orgProfile → owner/admin), and the dead-end "New proposal" CTA shown to viewers.
- **Drive sidebar entries off capabilities/ability**, not `relationship==='client'` (today architect/inspector/guest/org-viewer get the full operator menu).
- Read-only banner for viewers/participants on pages where they have no write capability.

**Acceptance:** No viewer/client/architect/inspector/guest sees a control they can't use (hidden or disabled+tooltip). The `capabilities` object is consumed, not discarded. Sidebar + page actions agree with backend enforcement. **Dual-role test:** an org-viewer who is also a project-client sees no company manage controls but DOES see client approval sign-off.

### Phase 4 — Role-management honesty, discoverability, onboarding

> **Reframe:** invite member / change role / remove / custom-role builder **already exist and work** in `dashboard/settings/team.tsx` (gated `canManage=owner||admin`). This phase makes them **discoverable and honest**, not "build role management."

**Backend:**
- Guard against demoting/removing the **last owner**.

**Frontend:**
- **Discoverability:** add a "Team & Settings" nav item to the construction dashboard (today reachable only via the org-switcher dropdown). Unify the two disconnected Settings surfaces (`sales/settings` org profile vs `dashboard/settings/team`) into one hub with cross-links.
- **Honest roles:** Role Builder toggles are now real (Phase 2) — remove any "not yet enforced" caveats. At invite/change time, **render a permission summary** (resource×action grants) for the selected role from the shared map, so owners see exactly what they're granting.
- **Team-settings route:** keep the `RequireCompany` membership guard (members legitimately view the roster read-only per matrix) + add a read-only banner; do **not** hard role-guard it away.
- **Onboarding:** `ensureUserOrganization` (`auth.ts`) auto-creates an org as `owner` on signup, so onboarding is a **non-blocking guided checklist** on the empty dashboard (complete company profile → invite teammates → create first project), not a blocking wizard.
- **Differentiate the four participant portals** (client/architect/inspector/guest) off `PARTICIPANT_PERMISSIONS`: e.g. inspector sees `inspection:request` but not `approvals:decide`; architect sees `queries:raise` but not `finances:dispute`; guest sees curated read-only.

**Acceptance:** An owner reaches team management from the main nav, builds a custom role whose restrictions actually take effect, and assigns it seeing its real permission summary. Viewers get an explanatory read-only experience everywhere. New owners are guided through setup. Each participant portal shows exactly its capability set.

---

## 6. UX gaps (37 found — grouped)

**Money & access exposed to the wrong people (critical):** escrow release / fund / dispute and project-participant invite/remove render to all roles (Phase 1 backend + Phase 3 UI). The Role Builder configures unenforced permissions (Phase 2).

**No "why blocked" feedback (high):** no toast system, interceptor handles only 401 → 403s die silently. Backend must also emit a role-aware reason string (Phase 1).

**Discoverability & settings fragmentation (high):** team/roles reachable only via the org-switcher dropdown; two disconnected "Settings" pages; new owners may never find member management (Phase 4).

**Misleading affordances (high/medium):** sidebar shows the full operator menu to participants and viewers (keys off `relationship==='client'` only); `updates.tsx` hides "New update" but leaves Edit/Delete/Approve open; sales "New proposal" CTA is a dead end for viewers; project budget Edit + panda-ai Run-analysis open to all roles (Phase 3).

**Broken/uneven portals (medium):** client/architect/inspector/guest get 403 on documents, change-requests, materials, equipment, permits (reads omit `projectRoles`); homeowner can't raise a payment dispute; comment rules differ per surface (Phase 1 + 2).

**Onboarding (medium):** signup collects `accountType` but never guides company-profile or teammate invites though an org is auto-created (Phase 4).

**Dual-role confusion (medium):** an org-member-and-participant shows as `relationship='company', canManage=false` — a tier the role picker never names; UI can show company affordances that 403 (Phase 3 union model).

---

## 7. Decisions to confirm

**Resolved:** granularity is delivered by **org-defined custom roles** (see §3 "Custom roles are the primary granularity mechanism"). Built-in `owner/admin/member/viewer` are just the out-of-the-box defaults; an org tunes anything finer by minting a custom role and assigning it. The app is pre-launch (no live customers depending on current behavior), so ship the stricter built-in defaults now.

**Built-in-role defaults — pick the baseline; orgs override via custom roles (each is a one-line table edit):**

1. **Finances approve** — built-in `member` default: release escrow / approve & pay invoices **off** (owner/admin only). An org needing finance approvers makes a `finance-approver` custom role. _Recommend: off by default._
2. **Documents delete** — built-in `member` default: off (owner/admin only), matching the stated `constructionContributor` intent.
3. **Participants manage** — built-in `member` default: off (owner/admin only).
4. **Inspections manage** — built-in `member` default: on (member can edit/delete, not just request).
6. **Comment threshold** — built-in `viewer`: no comment-post; `member`+ and client/architect/inspector overlay: yes. Applied consistently to all four comment routes.

**Genuine product decisions (not just defaults — they shape participant-overlay capabilities and surface area):**

5. **Change-request decisions** — can homeowner clients approve/reject change orders (like approval sign-off), or company-only? Determines whether to add a `changeRequests:decide` client-overlay capability.
7. **Guest scope** — full project read vs curated subset?
8. **Finances dispute** — does a company member retain on-behalf dispute, or is it strictly the `client` overlay?
9. **`/users` routes** — delete entirely (admin SPA already covers it) or retain admin-gated? _Recommend: delete — removes a whole class of future leak risk._
10. **Custom-role baseline** — should the Role Builder auto-include a `view` baseline (so a custom role is always usable), or require fully-explicit toggles with a visible permission summary? _Recommend: seed a baseline + show the summary (see §3 gotcha 1)._

---

## 8. Performance & scale

RBAC runs on the request hot path, so the design is built to keep per-request cost flat and guards O(1). Where it matters:

**Per-request auth resolution (the preHandler runs on every authenticated request).**
- Today the preHandler does: `getSession` (served from better-auth's `cookieCache`, 5-min TTL in `auth.ts:192` — usually **no** DB hit) + one `member` read (org roles) + one `project_participants` read (participant roles).
- This plan adds **one** more read — `organizationRole WHERE organizationId IN (user's orgs)` — and only when the caller actually holds a non-built-in role (the role names are already in hand from the `member` rows, so the query is skipped on the common path). Net: 2 reads → at most 3, once per request, never per route.
- The resolved `request.orgPermissions` map is then an **in-memory lookup** for every guard on that request. A page that fires 10 API calls pays the resolution **once per call's preHandler**, but each guard inside is a `Map.get().has()` — no DB. This is the whole reason for pre-resolving instead of calling better-auth's async `hasPermission` per guard (which would be N DB-touching awaits per request).

**Index gap to close (Phase 2).** The hot `member WHERE userId = ?` lookup has **no supporting index**: `member` only declares `unique(["organizationId","userId"])` (org-leading), which Postgres can't use for a `userId`-only filter. Add `index(member.userId)` (or `(userId, organizationId)`). The other two hot reads are already covered: `project_participants(user_id, status)` and `organizationRole(organizationId)` (via its unique). Without the `member` index, every authenticated request does a scan on a table that grows with total memberships.

**Caching strategy.** Default to **per-request resolution + the index above** rather than a permission cache — permissions are correctness-sensitive and a stale cache risks honoring a just-revoked role. better-auth keeps its own in-memory `cacheAllRoles` per org (`has-permission.mjs:29-30`) for its endpoints. If profiling later shows the resolution is hot, add a short-TTL in-process cache of `orgPermissions` keyed by `(userId, orgId)`, **invalidated on `createRole`/`updateRole`/`updateMemberRole`/member changes** — but treat that as an optimization gated on real numbers, not a default. Do **not** stash permissions in the better-auth cookie-cache session payload: the 5-min TTL would leave a role change unenforced for up to 5 minutes.

**`assertProjectPermission` adds no query.** Route handlers already load the project (`loadProject`) for the tenant check; the resource-action union is computed in memory from `request.orgPermissions` + the participant overlay. No extra round-trip beyond what routes do today.

**No N+1.** Permission resolution for all of a user's orgs is a single `whereIn` query, bounded by orgs-per-user (≈1 in practice). The `whereIn` list never fans out per route.

**Frontend cost is negligible.** `buildAbility` is memoized on role; ability maps are tiny (~15 resources × a few actions); `GET /projects/:id/access` is fetched **once per project** and cached by React Query (not per action); `<Can>`/`useAbility` are in-memory lookups. Mounting `AbilityProvider` at the app root adds one context, not re-fetches.

**Default-deny preHandler** is an in-memory `(method, path)` allowlist match per request — constant-time, no I/O.

## 9. Risks

- **Wide mechanical migration** (~21 modules in Phase 2): keep `assertCanModifyProject`/`assertCanActAsClient` as wrappers first, swap call-sites incrementally with tests so behavior stays bisectable.
- **Generated AC must reproduce org-management statements** exactly, or better-auth's `/api/auth/*` invite/role-change flows silently break — guard with the byte-equality CI test (a Phase-2 acceptance gate, not just a risk note).
- **Custom-role runtime resolution** depends on better-auth's `organizationRole` store shape; add an explicit test that a custom role granting a construction permission is honored, so a version change can't silently fall back to inert.
- **Default-deny allowlist** must early-return `/api/auth/*` before the auth requirement and be method-aware, or login itself / the invite-accept escalation break. Centralize it; smoke-test it.
- **Frontend/backend drift** only stays dead if both import the same data module — enforce with a real workspace package, not a re-exported backend file.
- **Phase sequencing**: co-release backend enforcement and frontend gating per resource (or feature-flag) to avoid the transient visible-button-that-403s.
- **Reads must not regress**: passing `projectRoles` on the leak fixes is mandatory — otherwise Phase 1 fixes the leak and breaks legitimate homeowner reads at the same time.
