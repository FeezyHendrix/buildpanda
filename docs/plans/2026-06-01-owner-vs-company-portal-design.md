# Design: Separating the Homeowner (project owner) from the Company (contractor)

Status: Draft for review — no code yet.
Date: 2026-06-01

## 1. Problem & goals

A construction company manages many builds for many clients. Today buildpanda
conflates two very different relationships to a project:

- **The managing company** (contractor + its staff) — should manage everything.
- **The homeowner / client** whose building it is — should get a simple,
  read‑mostly **portal to watch their own building** and act only on the things
  that are genuinely theirs (sign‑offs, questions, payment approvals).

Goals:
1. A contractor can **invite a homeowner to a single project** and give them a
   portal — without exposing the company's other clients or projects.
2. The homeowner sees a **different, simplified view** scoped to their build(s).
3. Company staff keep the full management workspace.
4. Reuse the existing org/RBAC plumbing; do not duplicate it.

Non‑goals (this phase): client‑to‑client messaging, multiple companies per
project, billing/subscription tiers, granular per‑field permissions.

## 2. What exists today (baseline)

- `user.accountType`: `project_owner` | `construction_company` | `project_manager`
  (set at sign‑up, currently inert).
- **Organizations = companies** (better‑auth org plugin). Company staff are
  `member` rows with roles `owner | admin | member | viewer` (org‑wide).
- `projects.organization_id` (managing company), `projects.owner_id` (a user,
  currently the creator; ambiguous).
- `assertCanAccessProject` / `assertCanModifyProject` grant access if
  `owner_id === user` OR the user is a member of the project's org.

**Key constraint:** better‑auth org membership is *company‑wide*. A homeowner must
NOT be an org member, or they'd see every project in the company. The client must
attach to a **project**, not the organization.

## 3. Core model — `project_participants`

A homeowner (and later: architect, inspector, co‑owner) is attached to a project
via a participants table. Company staff are **not** participants — they reach the
project through org membership as today.

```sql
CREATE TABLE project_participants (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         text REFERENCES "user"(id) ON DELETE SET NULL, -- null while invite pending
  email           text NOT NULL,            -- invite target / display
  role            text NOT NULL,            -- 'client' | 'architect' | 'inspector' | 'guest'
  status          text NOT NULL DEFAULT 'invited', -- 'invited' | 'active' | 'revoked'
  invited_by_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  invite_token    text,                     -- for accept link; cleared on accept
  invite_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_participants_project_user ON project_participants(project_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX project_participants_user ON project_participants(user_id, status);
CHECK (role IN ('client','architect','inspector','guest'));
CHECK (status IN ('invited','active','revoked'));
```

Notes:
- `owner_id` on `projects` is **deprecated in meaning** going forward (kept for
  back‑compat / seed rows). The homeowner is now an `active` participant with
  role `client`. Optionally add `projects.client_id` later as a denormalised
  pointer to the primary client, but the participants table is the source of truth.
- Multiple clients per project are supported (e.g. a couple); the first/primary
  is whichever you choose to surface.

## 4. Access & capabilities

Replace the binary owner/member check with a single resolver that returns the
viewer's **relationship** to a project and a capability set.

```
resolveProjectAccess(project, { userId, orgRoles, participantRole }) ->
  | { relationship: 'company', orgRole: 'owner'|'admin'|'member'|'viewer', can: <orgRole caps> }
  | { relationship: 'client'|'architect'|'inspector'|'guest', can: <participant caps> }
  | { relationship: 'none' }  // -> 403
```

Access (read) is granted if **any** of:
- user is a member of `project.organization_id` (company staff), OR
- user is an `active` participant on the project, OR
- legacy: `owner_id === user` / world‑readable seed rows.

### Capability matrix (what each relationship can do)

| Capability | Company owner/admin | Company member | Company viewer | **Client** | Architect | Inspector |
|---|---|---|---|---|---|---|
| View everything | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit stages / activities / schedule | ✓ | ✓ | – | – | – | – |
| Edit budget / finances | ✓ | – | – | – | – | – |
| Materials / contractors / permits | ✓ | ✓ | – | – | – | – |
| **Decide Approvals** (sign‑off) | ✓ | – | – | **✓** | – | – |
| Raise / comment **Queries** | ✓ | ✓ | – | **✓** | ✓ | ✓ |
| Answer Queries | ✓ | ✓ | – | – | ✓ | – |
| Comment on items | ✓ | ✓ | – | **✓** | ✓ | ✓ |
| Approve milestone **payment release** | ✓ (request) | – | – | **✓ (approve)** | – | – |
| Change‑request **decision** | ✓ | – | – | optionally ✓ | – | – |
| Manage participants / settings / team | ✓ | – | – | – | – | – |

The **client** is the homeowner: read‑all + the decisions that belong to them
(approve selections, approve money leaving escrow, ask questions). Everything that
is "running the build" stays with the company.

Implementation: a `requireCapability(project, ctx, cap)` helper used in routes,
replacing direct `assertCanModifyProject` where finer control is needed. Existing
company‑only mutations keep `assertCanModifyProject` (which already excludes the
client because a client is not an org member and not the legacy owner).

## 5. Two shells, one data set

`accountType` decides the **landing app shell**; the per‑project **view** is
decided by the viewer's relationship to that project (so the same person can be a
client on their build and staff on another).

- `project_owner` → **"My Build" client shell**. Dashboard lists projects where
  the user is an `active` client participant. No "create project", no company
  settings.
- `construction_company` / `project_manager` → **company shell** (today's
  dashboard): all org projects, create projects, manage staff.

### Project workspace nav by relationship

| Client portal ("My Build") | Company workspace (existing) |
|---|---|
| Overview (progress, photos, What's Next) | Everything (current nav) |
| Updates / site photos | + Build Stages, Site Activity, Daily Log, Project Chart, Key Dates |
| Documents & Plans (view) | + Materials, Change Requests, Permits |
| Finances (view + **approve payments**) | + Team, Settings, full edit on all |
| **Approvals** (decide), **Queries** (raise), Messages | full management |

The client nav is a curated subset rendered when `relationship === 'client'`.
Same routes/pages, but: (a) management‑only nav items hidden, (b) pages render in
read mode with only the client's allowed actions enabled.

## 6. Invite flow — "contractor gives the owner a portal"

Distinct from the better‑auth **org** invitation (which means "join my company as
staff"). This is a **project‑scoped client invite**.

1. Company staff open a project → **Invite homeowner** → enter name + email
   (+ role, default `client`).
2. `POST /projects/:id/participants/invite` creates a `project_participants` row
   with `status='invited'`, a one‑time `invite_token`, and emails an accept link
   (`/accept-project-invite/:token`). Reuse the ZeptoMail sender.
3. Homeowner clicks the link:
   - If signed out and no account → sign‑up prefilled with `accountType=project_owner`,
     then auto‑accept.
   - On accept: set `user_id`, `status='active'`, clear the token.
4. They land in **My Build** scoped to that project.

Revoke = set `status='revoked'` (keeps history); they immediately lose access.

## 7. API surface (new)

- `GET  /projects/:id/participants` — list (company manage view).
- `POST /projects/:id/participants/invite` — invite a client/architect/inspector.
- `PATCH /projects/:id/participants/:participantId` — change role / revoke.
- `DELETE /projects/:id/participants/:participantId` — remove.
- `POST /project-invites/:token/accept` — accept (auth required; creates link).
- `GET  /project-invites/:token` — preview invite (project name, inviter) pre‑auth.
- `GET  /me/projects` — already implicit via `/projects`; ensure it returns
  projects where the user is an active participant **or** an org member, so the
  homeowner's dashboard works.

`/projects` listing logic changes from "owner_id or my orgs" to
"my orgs **or** active participant".

## 8. Migration & interaction with the in‑progress org/RBAC work

- New migration `XXXX_project_participants.ts` (additive; safe alongside the org
  migrations already in flight).
- No change to better‑auth org tables. The client path is **parallel** to org
  membership, not built on it — this is deliberate (org membership = company‑wide).
- `authorization.ts` gains the participant lookup; `auth-context` should load the
  caller's participant roles per request (like it already loads `orgRoles`),
  e.g. `request.projectRoles: Map<projectId, participantRole>` — or resolve
  on‑demand in the project routes to avoid a query on every request.
- Recommended: resolve participant role inside the project route (one query by
  `(project_id, user_id)`), not globally, since most requests are project‑scoped.

## 9. Phasing

1. **Phase 1 (backend foundation):** migration + participants module (CRUD +
   invite/accept) + extend project access resolver + `/projects` listing change.
   Verify the client can read but not manage; can decide approvals + raise queries.
2. **Phase 2 (client shell):** accountType‑driven routing to "My Build", the
   client dashboard (their projects), and the client project nav subset.
3. **Phase 3 (polish):** company "Invite homeowner" UI in the project, participant
   management screen, revoke, and per‑page read‑mode rendering.

## 10. Open questions

- Should the **client** be allowed to decide **Change Requests** (cost/time), or
  only Approvals + payment release? (Default proposed: Approvals + payments only.)
- One primary client vs many co‑owners on the same build — supported by the table;
  which one drives "the" homeowner label?
- Do architects/inspectors get logins now, or is `client` the only participant
  role we ship first? (Recommend ship `client` first; table already supports the rest.)
