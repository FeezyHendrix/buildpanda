# Procore-style RFIs + BIM for BuildPanda — Build Plan

> Date: 2026-06-14
> Status: Draft for review (plan only — no code yet)
> Scope: Add a professional RFI workflow and a web BIM model viewer to BuildPanda, composed with the existing project/RBAC/portal/suite infrastructure.

---

## Summary

BuildPanda already ships a lightweight RFI analog (the `queries` module) and a `change_requests` module. This plan grows them into a **Procore-grade RFI workflow** and adds a **web BIM viewer**, then wires both into onboarding, the owner/client portal, and the construction suite.

Two decisions anchor everything:

1. **RFIs = a NEW `rfis` module, NOT an extension of `queries`.** `queries` stays as the homeowner-friendly "ask a question" surface. RFIs are a separate, formal, numbered, ball-in-court workflow with external email responders and change-event conversion. They share patterns (module scaffold, comments table, auth decorators) but are a distinct table and lifecycle. Rationale in §3.
2. **BIM v1 = IFC-only, converted to ThatOpen Fragments, rendered client-side, models stored in the existing S3 storage.** `.rvt`/`.nwd` and clash detection are explicitly deferred. Rationale + honest tech assessment in §5.

Everything is gated behind the construction suite (`projects.project_type = 'build'`, per the suites backbone) and reuses — never rebuilds — files/S3, documents, participants/`computeAccess`, notifications, and the owner portal.

### Three corrections to the original grounding (verified against the codebase)

The source brief asserted three things that are **wrong** and would have produced a flawed plan. Verified facts:

| Brief claimed | Reality (verified) | Impact |
|---|---|---|
| "local disk + multipart" storage | `lib/file-storage.ts` uses **AWS S3** (`@aws-sdk/client-s3` + `@aws-sdk/lib-storage` multipart `Upload`), MinIO-compatible via `endpoint`/`forcePathStyle` | BIM large-file storage is **already mostly solved** — S3 multipart exists. The real gap is the 25 MB API cap and direct-to-S3 upload, not "replace local disk". |
| "newest migration ~20260623, new ones 20260624+" | Newest is **`20260630_file_shares`** | New migrations must be dated **`20260701+`**. |
| (implied) raise upload limit globally | `UPLOAD_MAX_BYTES` default is **25 MB**, `files: 5` in `modules/files/routes.ts` | BIM models (50 MB–2 GB) must **bypass** the buffered multipart route via presigned direct-to-S3 upload, not just bump the limit. |

---

## How this ties into the existing system

All file paths are real and verified.

### RFIs build on / reuse

- **`queries` module** — `packages/backend/src/modules/queries/{types,repository,service,routes}.ts` + migration `db/migrations/20260611_queries.ts`. Schema: `queries(id, project_id, subject, question, status['Open'|'Answered'|'Closed'], answer, due_date, asked_by_id, answered_by_id, answered_at, created_at, updated_at)` + `query_comments(id, query_id, author_id, author_name, body, created_at)`. Routes use `request.requireProjectAccess/requireProjectWrite/requireProjectPermission` and `assertCanActAsClient` (client can create). Frontend: `packages/frontend/src/pages/project/queries.tsx` + `hooks/use-queries.ts`. **The RFI module mirrors this scaffold** but is its own table/lifecycle.
- **`change_requests`** — `packages/backend/src/modules/change-requests/*` + `db/migrations/20260613_change_requests.ts` (`status` default `'Draft'`, currency CHECK, `change_request_comments`). RFI "response → change event" creates a `change_request` linked back to the RFI.
- **Module scaffold template** — `packages/backend/src/modules/materials-equipment/` (types/repository/service/routes) is the canonical 3-layer shape to copy.

### BIM builds on / reuse

- **S3 storage** — `packages/backend/src/lib/file-storage.ts`: `saveStream(ownerId, …)`, `openStoredFile(storagePath)`, `deleteStoredFile`, `streamToBuffer`. Uses S3 multipart `Upload`; bucket auto-ensured on startup. Prod env has `AWS_ACCESS_KEY_ID/AWS_REGION` + a Railway S3 bucket; local dev points `endpoint` at MinIO.
- **Files/Documents** — `modules/files/` (`uploaded_files`, multipart route, `fileSize: config.uploads.maxFileBytes` = 25 MB, `files: 5`), `modules/documents/` (`document_categories` global + `project_documents` + `document_versions` version chain). The new `lib/project-documents.ts` `attachImportedDocument()` helper (just shipped) is the model for attaching a processed model artifact into a category.
- **Async jobs** — `lib/queue/` (`QueueManager`, BullMQ + Redis; prod has `REDIS_URL`). BIM IFC→Fragments conversion runs here, exactly like `programme_import_jobs` / `boq_import_jobs`.

### Both reuse

- **RBAC** — `packages/backend/src/lib/permissions.ts` `statement` catalog (camelCase `resource: [actions]`, e.g. `documents: ['view','upload','delete']`) + presets `constructionFull` / `constructionContributor` / ReadOnly; `createAccessControl(statement)`. `lib/authorization.ts` (`assertCanAccessProject/Modify/ProjectPermission`, `assertCanActAsClient`). `plugins/auth-context.ts` decorators (`requireProjectAccess/Write/Permission`). **New `rfis` and `bim` resources MUST be added to `statement` AND to every preset**, or existing roles get zero actions on them (see Critique C-2).
- **Participants / ball-in-court** — `modules/participants/` ; `project_participants.role ∈ {client, architect, inspector, guest}`; `computeAccess(project, request)` (~`participants/index.ts:103`) returns `ProjectAccess` (`canRaiseQueries`, `canDecideApprovals`, `canViewAll`, `canManageParticipants`, `canComment`, …). RFI ball-in-court assignees map onto these participants.
- **Notifications** — `modules/notifications/` + `db/migrations/20260622_notification_preferences.ts` (`notification_preferences(user_id, type)` + a `notifications_type_check` CHECK). **New RFI notification types must extend that CHECK** (see Critique C-5).
- **Suite backbone** — `docs/plans/2026-06-13-suites-expansion-design.md` (designed, not built): `projects.project_type ∈ {build, interior, facility}` + a `requireProjectSuite` guard. RFIs/BIM are **construction-suite** features and must compose with this rather than assume every project has them.
- **Owner portal** — `docs/plans/2026-06-01-owner-vs-company-portal-design.md`; `project-layout.tsx` threads `access: ProjectAccess` via `useProjectAccess` + mounts `ReadOnlyBanner` + `ProjectOutletContext`; `project-sidebar.tsx` renders a curated view for non-company relationships; owners land on `my-build.tsx`; `accept-project-invite.tsx` is the invite-accept flow.

---

## RFI feature — full design

### Domain model (Procore-grade, distilled)

Lifecycle: **Draft → Open → (In Review) → Answered → Closed**, with **Void** and **Reopened** as side states. Each RFI has a **ball-in-court** (the participant who currently owns the next action), a **project-scoped sequential number** (`RFI-001`…), an **official response** (distinct from draft/proposed responses and from thread comments), a **distribution list** (including external email responders who reply without logging in), **due dates + reminders**, **"Related To" links** (documents, drawings, BIM objects, change events), and optional **cost/schedule impact** that can be **converted into a `change_request`**.

### Data model (DDL — new migration `20260701_rfis.ts`)

```
rfis
  id                text pk
  project_id        text not null  -> projects(id) on delete cascade
  number            integer not null              -- sequential per project (see numbering)
  subject           text not null
  question          text not null
  status            text not null default 'Draft'
                    CHECK in ('Draft','Open','InReview','Answered','Closed','Void')
  ball_in_court_id  text -> user(id) on delete set null   -- current owner of next action
  assignee_role     text                                   -- snapshot: client|architect|inspector|company
  priority          text not null default 'Normal' CHECK in ('Low','Normal','High')
  due_date          date
  official_response       text                              -- the answer of record
  official_responded_by   text -> user(id) on delete set null
  official_responded_at   timestamptz
  cost_impact       boolean not null default false
  schedule_impact   boolean not null default false
  change_request_id text -> change_requests(id) on delete set null   -- if converted
  created_by_id     text -> user(id) on delete set null
  reopened_count    integer not null default 0
  created_at / updated_at timestamptz
  UNIQUE (project_id, number)
  index (project_id, status), (project_id, ball_in_court_id)

rfi_comments            -- thread + proposed (non-official) responses
  id, rfi_id -> rfis on delete cascade, author_id, author_name, body,
  is_proposed_response boolean default false, created_at
  index (rfi_id, created_at)

rfi_links               -- "Related To"
  id, rfi_id -> rfis on delete cascade,
  target_type text CHECK in ('document','bim_object','change_request'),
  target_id   text,            -- project_documents.id | bim_object GUID | change_requests.id
  target_model_id text,        -- bim_models.id when target_type='bim_object'
  created_at
  index (rfi_id)

rfi_distribution        -- who is notified / can respond (internal + external)
  id, rfi_id -> rfis on delete cascade,
  user_id text -> user(id) on delete set null,   -- null for external-only
  email   text,                                   -- external responder
  name    text,
  role    text CHECK in ('responder','viewer'),
  reply_token text unique,    -- opaque token for external email reply (see security)
  token_expires_at timestamptz,
  created_at
  index (rfi_id)

rfi_events              -- immutable audit trail (Procore "history")
  id, rfi_id -> rfis on delete cascade,
  type text,            -- created|opened|response_proposed|answered|reopened|closed|voided|ball_in_court_changed|reminder_sent
  actor_id text, actor_label text, detail jsonb, created_at
  index (rfi_id, created_at)
```

### Numbering (concurrency-safe — addresses Critique C-1)

Do **not** compute `MAX(number)+1` in app code (race → duplicate numbers under concurrent creates). Allocate inside the same transaction with a per-project counter row and `SELECT … FOR UPDATE`, or a Postgres sequence-per-project. Chosen: a `rfi_counters(project_id pk, next_number int)` row, incremented `… FOR UPDATE` in the create transaction. The `UNIQUE(project_id, number)` constraint is the backstop.

### Ball-in-court state machine

- **Create (Draft)**: ball = creator. **Open** sets ball = the chosen responder (a participant or the company). 
- **Responder proposes** (`rfi_comments.is_proposed_response`): ball returns to an RFI manager (company) for **official** sign-off.
- **Manager posts official response → Answered**: ball = original asker to accept/close.
- **Close**: terminal. **Reopen** (`reopened_count++`, status → Open) is allowed from Answered/Closed by a manager or the asker; ball resets to responder. **Reopen loops** are bounded only socially — log every transition in `rfi_events` and surface `reopened_count` (Critique C-3 edge case).
- **Responder leaves org / participant removed**: ball_in_court_id may point at a now-removed participant → on participant removal, reassign open RFIs' ball to the company manager and write an `rfi_events` entry (Critique C-3).

### External email reply (no login) — security (addresses Critique C-4)

Reuse the existing public-token pattern from file-shares/proposals (`modules/file-shares/public-routes.ts`, `proposals/public-routes.ts`).

- Each external responder row gets a **single-use, expiring `reply_token`** (opaque, 32+ bytes, hashed at rest — store hash, send raw in the email link), `token_expires_at` (e.g. 14 days).
- Public route `POST /rfi-reply/:token` accepts the response body, verifies token + expiry + not-already-consumed, attributes the comment to `rfi_distribution.email/name`, and **rotates/consumes** the token. No session, no project access granted beyond posting that one response.
- **Anti-spoofing**: the token is the only authority; never trust the `From:` header. Rate-limit by token. A consumed/expired token returns a neutral "this link is no longer valid" page. Email replies land as `rfi_comments` (proposed) → still require company official sign-off before becoming the answer of record (so an external responder cannot unilaterally "close" anything).

### Response → change event

When an RFI has `cost_impact`/`schedule_impact`, a manager action `POST /projects/:id/rfis/:rfiId/convert-to-change` creates a `change_requests` row (status `Draft`), sets `rfis.change_request_id`, and writes an `rfi_events` entry. Reuses the existing change-requests module; no new change-event machinery.

### Reminders / overdue (reuses queue + notifications)

A repeating queue job (BullMQ, like existing jobs) scans open RFIs with `due_date` approaching/passed and emits notifications (respecting `notification_preferences`) to the current ball-in-court. External responders get an email via `lib/mail.ts` (`sendEmail`). Each send writes an `rfi_events` `reminder_sent`.

### RBAC additions

Add to `lib/permissions.ts` `statement`: `rfis: ['view','create','respond','manage']`. Add to **every** preset:
- `constructionFull`: `rfis: ['view','create','respond','manage']`
- `constructionContributor`: `rfis: ['view','create','respond']`
- ReadOnly / client: `rfis: ['view','create']` (a client can raise an RFI + view official responses; cannot post official responses). Client creation also gated by `assertCanActAsClient`, mirroring queries.

### API routes (mirror queries/materials-equipment shape)

```
GET    /projects/:id/rfis                      requireProjectAccess        ?status=&ballInCourt=mine
POST   /projects/:id/rfis                      requireProjectPermission(rfis,create)  (+assertCanActAsClient for clients)
GET    /projects/:id/rfis/:rfiId               requireProjectAccess
PATCH  /projects/:id/rfis/:rfiId               requireProjectPermission(rfis,manage)  -- status/ball/due/links
POST   /projects/:id/rfis/:rfiId/respond       requireProjectPermission(rfis,respond) -- proposed OR official(manage)
POST   /projects/:id/rfis/:rfiId/comments      requireProjectPermission(comments,post)
POST   /projects/:id/rfis/:rfiId/convert-to-change   requireProjectPermission(rfis,manage)
POST   /projects/:id/rfis/:rfiId/distribution  requireProjectPermission(rfis,manage)
GET    /rfi-reply/:token        (public)       -- render external response form
POST   /rfi-reply/:token        (public)       -- accept external response, consume token
```
All request/response schemas inline as `as const` JSON schemas; IDs via `generateId`; 3-layer module (`types`/`repository`/`service`/`routes`).

### Frontend

- New page `packages/frontend/src/pages/project/rfis.tsx` (+ `rfi-detail`) mirroring `queries.tsx`/`action-items.tsx`; hook `hooks/use-rfis.ts` (React Query v5).
- Sidebar entry in `project-sidebar.tsx` under the construction/site-control group; shown only for construction projects and per the curated/owner view rules.
- RFI detail: thread, official response panel (manager-only), ball-in-court badge, due/overdue, "Related To" (link picker for documents + BIM objects), convert-to-change button, distribution editor.

---

## BIM feature — full design

### Honest tech assessment (verified 2026-06-14)

| Option | License | Native .rvt/.nwd? | Hosting | Verdict for BuildPanda v1 |
|---|---|---|---|---|
| **ThatOpen / web-ifc** (`@thatopen/components`, `web-ifc` MPL-2.0, `@thatopen/fragments`) | Permissive (MPL-2.0) | No (IFC only) | Self-host, client-side WASM + optional Node | **CHOSEN.** Free, no vendor lock-in, GUID mapping, fragments perf. |
| **xeokit** (xeokit-sdk, xeokit-convert) | **AGPL-3.0** (or paid commercial) | No (IFC via alpha web-ifc, or cxConverter) | Self-host | **Rejected for v1**: AGPL forces open-sourcing the whole SaaS, or a paid commercial license. Revisit only if a commercial license is purchased. |
| **Autodesk APS / Forge Viewer** | Viewer free; **Model Derivative API metered** (~1.5 tokens/Revit-or-Navisworks model, pricing rising Dec 2025) | **Yes** (cloud translation to SVF) | Cloud-only (upload to Autodesk) | **Deferred to a later phase.** The only realistic path to native .rvt/.nwd on web, but pay-per-call + cloud lock-in + data-sovereignty concerns. |
| three.js + glTF (server IFC→glTF) | Permissive | No | Self-host | Fallback. Simpler viewer but loses IFC metadata/GUIDs → can't anchor issues to elements. Inferior to fragments. |

**Format reality (confirmed):** only **IFC** is openly web-renderable. `.rvt`/`.nwd` are proprietary and require Autodesk cloud or a desktop export to IFC. **v1 accepts `.ifc` only**; the upload UI instructs users to "Export to IFC" from Revit/Navisworks (same pattern as the programme `.mpp → .xml` decision already shipped).

### Pipeline (v1)

1. **Upload** `.ifc` (50 MB–2 GB) **directly to S3** via a **presigned PUT** (or presigned multipart for >100 MB), issued by the backend — **bypassing** the 25 MB buffered multipart route (Critique C-7). Browser → S3 directly; backend only records metadata.
2. **Register** `bim_models` + first `bim_model_versions` row (status `Processing`), enqueue a BullMQ conversion job (like `programme_import_jobs`).
3. **Convert** server-side in the job worker: run **web-ifc / ThatOpen IFC→Fragments** in Node, producing a compact `.frag` plus an element index (GUID → expressID, type, name, basic property sets). Store the `.frag` back in S3; persist the element index in `bim_elements` (or a JSON sidecar in S3 for huge models — see C-6). Mark version `Ready` (or `Failed` with a reason).
4. **View** client-side: `@thatopen/components` `FragmentsManager` loads the `.frag` from a signed S3 URL via the fragments worker; `IfcLoader` is only needed if converting in-browser (we convert server-side, so the browser loads `.frag` directly — much faster, lower memory).
5. **Anchor issues/RFIs** to elements via IFC **GUID** (`fragments.guidsToModelIdMap(guids)`), not raw expressIDs (which change on re-version — C-6).

### Data model (new migration `20260702_bim.ts`)

```
bim_models
  id, project_id -> projects on delete cascade, name, discipline,
  current_version_id text, created_by_id, created_at, updated_at
  index (project_id)

bim_model_versions
  id, bim_model_id -> bim_models on delete cascade, version int,
  source_file_id text -> uploaded_files(id),     -- the original .ifc in S3
  fragments_storage_path text,                    -- the converted .frag in S3
  status text CHECK in ('Processing','Ready','Failed'), failure_reason text,
  size_bytes bigint, element_count int, created_at
  UNIQUE (bim_model_id, version)

bim_coordination_issues          -- model-anchored issues, linkable to RFIs
  id, bim_model_id -> bim_models on delete cascade,
  element_guid text,             -- stable IFC GlobalId (nullable for xyz-only)
  position jsonb,                -- {x,y,z} fallback anchor
  title, description, status text CHECK in ('Open','Closed'),
  rfi_id text -> rfis(id) on delete set null,     -- promote an issue to an RFI
  assignee_id text -> user(id) on delete set null,
  created_by_id, created_at, updated_at
  index (bim_model_id, status)
```

(Element index `bim_elements(model_version_id, guid, express_id, ifc_type, name)` optional — only if we need server-side search; for v1 the `.frag` + client GUID map may suffice. Decide at build time based on model sizes.)

### RBAC

`statement` add `bim: ['view','upload','manage']`. Presets: `constructionFull` full; contributor `['view','upload']`; ReadOnly/client `['view']` (owner can view model read-only — §8).

### API routes

```
GET    /projects/:id/bim/models                         requireProjectAccess
POST   /projects/:id/bim/models/upload-url               requireProjectPermission(bim,upload)  -> presigned S3 PUT
POST   /projects/:id/bim/models                          requireProjectPermission(bim,upload)  -- register after upload, enqueue convert
GET    /projects/:id/bim/models/:modelId                 requireProjectAccess
GET    /projects/:id/bim/models/:modelId/fragments-url   requireProjectAccess  -> signed GET for .frag
GET/POST/PATCH /projects/:id/bim/models/:modelId/issues  requireProjectAccess / requireProjectPermission(bim,manage)
POST   /projects/:id/bim/models/:modelId/issues/:issueId/promote-to-rfi  requireProjectPermission(rfis,create)
```

### Frontend (lazy, heavy chunk)

- `packages/frontend/src/pages/project/bim.tsx` mounted via `React.lazy` (Three.js + WASM is a large bundle — never in the main chunk; matches `App.tsx`'s existing lazy pattern).
- Viewer component wraps `@thatopen/components` world + `FragmentsManager`; loads `.frag` from the signed URL; element selection emits GUID → used to create coordination issues / link RFIs.
- Upload UX: pick `.ifc` → request presigned URL → browser uploads to S3 with progress → register → poll version status until `Ready`. Clear "Export to IFC" guidance for Revit/Navisworks users.

### Deferred (explicitly out of v1)

Clash detection, 2D penetration/blockout validation, AR site comparison, 3D takeoff, model federation (multiple linked models — schema allows it but UI is later), native `.rvt`/`.nwd`, in-browser conversion of 2 GB models.

### BIM dimensions — 3D + 4D + 5D in v1 (6D/7D deferred)

"BIM dimensions" are data layers fused onto the 3D model. BuildPanda already owns the 4D and 5D **data** in existing modules; the BIM viewer's **IFC GUID anchoring** (the same mechanism used for coordination issues/RFIs) is what turns that data into true multi-dimensional BIM. v1 builds 3D + 4D + 5D:

- **3D (geometry)** — IFC → Fragments viewer (§ pipeline above).
- **4D (time / sequencing)** — link existing **schedule activities / `project_phases`** to model element GUIDs and visualize the construction sequence on the model (timeline scrubber). Data already exists (programme importer, phases, key dates).
- **5D (cost)** — link existing **`change_requests` / finances / materials (BoQ)** to model element GUIDs so cost/change impact is visible per element. Data already exists.

New anchor table (in the BIM migration): `bim_element_links(id, bim_model_id, element_guid, link_type ['phase'|'activity'|'change_request'|'cost_item'], target_id, target_table, created_at)`. Anchoring uses **stable IFC GlobalId**, never expressID (re-version safe — C-6). Viewer overlays: a 4D timeline scrubber (color elements by phase/status as the schedule plays) and a 5D cost tint (color/annotate elements by linked change-event/cost). Both reuse the existing schedule (`stages`/`key-dates`/programme) and cost (`change-requests`/`finances`/`materials`) services via their service layer — no data duplication.

- **6D (sustainability)** and **7D (facility management)** — **deferred.** 6D has no existing data foundation (net-new capture). 7D composes later with the designed **Facilities suite** (`project_type='facility'`) using as-built models + documents (manuals/warranties).

This reframes BIM as the visual layer over data BuildPanda already owns, at low marginal cost because the 4D/5D data and services already ship.

---

## Cross-cutting integration

- **Permission catalog** — single PR adds `rfis` + `bim` to `statement` and **all** presets (C-2). Add a unit test asserting every preset key ⊆ statement keys to prevent zero-action regressions.
- **Links graph** — `rfi_links` (RFI↔document/bim_object/change_request) + `bim_coordination_issues.rfi_id` + `rfis.change_request_id` form the RFI↔BIM↔change-request triangle. All FKs `ON DELETE SET NULL` so deleting one side never cascades destructively.
- **Shared async/storage infra** — BIM conversion uses the existing `QueueManager`/BullMQ/Redis and S3; no new infra. Presigned-upload helper added to `lib/file-storage.ts` (new `getUploadUrl`/`getDownloadUrl`), reused by any future large-file feature.
- **Suite composition** — both features gated by `requireProjectSuite('build')` (from the suites backbone) and only surfaced in the sidebar for `project_type='build'`. If the suites backbone is not yet built when this ships, gate on a simple `project_type` check and a feature flag, and migrate to `requireProjectSuite` when it lands (sequencing note S-1).

---

## Onboarding

### (a) Account creation — tailored by faction

Builds on the **existing** `user.accountType`/`profession` (migration `20260606_user_account_type.ts`) and `sign-up.tsx`'s `ACCOUNT_TYPES = {project_owner, construction_company, project_manager}`.

- **Faction 1 — Project Owner (diaspora client):** sign-up branch asks current (diaspora) location, project location back home, what to build, budget, owns-land?, **has plans/drawings/BIM/permits?**, timeline, involvement, "want BuildPanda Consulting to manage end-to-end?". Sets `accountType='project_owner'`, **auto-associates the BuildPanda Consulting managing org** as the company side (the owner becomes a `client` participant on a project where BuildPanda staff are the company), lands on `my-build.tsx`.
- **Faction 2 — Builder:** construction-company (org owner/admin, creates an organization) or team member (joins via invite). Sets `accountType='construction_company'`/`project_manager`, lands on `/dashboard`.
- **BuildPanda Consulting model:** a designated consulting organization + a `managed-project` linkage so the contractor-invites-owner relationship is **pre-wired** for owners (owner = client participant; BuildPanda staff = company). Data: reuse `org-profile`/organizations + `project_participants`; add a `projects.managed_by_org_id` (or a flag) only if needed.
- Reuses existing route-guards/`HomeRedirect`/`my-build`. No auth rebuild.

### (b) Project-creation wizard — seed existing assets

Extend `packages/frontend/src/pages/project/create.tsx` (5-step wizard) + step components. Today step 2 (`location-step.tsx`) asks "Do you own the land?" and uploads land docs via the **best-effort, non-blocking** `uploadLandDocuments(projectId, files)` (fetches `/projects/:id/documents/categories`, finds "Land Documents", POSTs `/files` + `/projects/:id/documents`; failure never blocks creation).

- Add intricate "what already exists?" questions: architectural plans, structural/MEP drawings, **BIM/IFC models**, permits, contracts, site photos, delivery method, disciplines.
- When provided, **seed** by **reusing the same best-effort pattern**: documents → correct categories; **IFC model → create `bim_models` + first version + enqueue conversion**; drawings → registered as documents available as RFI "Related To" references.
- **Keep it strictly non-blocking** (C — integration): seeding runs after the project exists and never fails project creation. BIM upload uses the presigned-URL path, not the 25 MB route.

---

## Owner / client portal

Extend the **existing** portal (`project-layout.tsx` `access`/`ReadOnlyBanner`/`ProjectOutletContext`, `project-sidebar.tsx` curated view, `my-build.tsx`, `accept-project-invite.tsx`, `participants.computeAccess`). Do **not** rebuild it.

What an invited owner (`client` participant) sees:
- **BIM**: read-only viewer of the project model (`bim:['view']`). No upload, no issue management.
- **RFIs**: owner-visible RFIs only; can **raise an RFI as a client** (`assertCanActAsClient`, `rfis:['view','create']`) and read **official** responses. **Internal RFIs and proposed (non-official) responses stay company-internal.**
- Plus the existing owner surface: timeline/stages, material usage, finances (their escrow/milestone funding view — **NOT internal cost markups/margins**), updates, key dates, shared documents, approvals sign-off, queries.

Scoping is enforced in `computeAccess`/the RFI service (filter `WHERE` clauses by relationship), not just hidden in the UI (C — integration). Add an `rfis.visibility ∈ ('internal','shared')` column (default `internal`; client-raised RFIs default `shared`) so "owner-visible" is data-driven, not heuristic.

Contractor-invites-owner flow is unchanged: company invites via `participants` → owner accepts via `accept-project-invite.tsx` → `computeAccess` grants the curated capabilities.

---

## Edge-case catalog

**RFI**
- Numbering race under concurrent creates → counter row `FOR UPDATE` + `UNIQUE(project_id, number)`.
- Concurrent official responses → only `rfis.manage` can post official; last-write guarded by optimistic `updated_at` check; thread keeps both as proposed.
- Reopen after close / reopen loops → allowed, `reopened_count++`, every transition in `rfi_events`; surface count.
- Ball-in-court points at a removed participant → on participant removal, reassign open RFIs to company manager + audit event.
- External email security: token spoofing/replay → single-use hashed expiring token; consumed tokens neutral-fail; external replies are proposed-only, never closing.
- RFI "Related To" a superseded document/drawing version → link stores `project_documents.id`; show a "newer version exists" hint via the version chain.
- Client raises RFI but lacks project write → `assertCanActAsClient` + `rfis:create` only; cannot self-answer.
- Convert-to-change when a change_request already exists → idempotent (reuse existing `change_request_id`).

**BIM**
- 2 GB upload interrupted → presigned **multipart** S3 upload (resumable parts); orphaned parts cleaned by lifecycle rule / a sweep job.
- Upload orphans (registered version but conversion never ran / browser died mid-upload) → versions stuck `Processing` past a TTL are marked `Failed` by a sweep; S3 objects with no `Ready` version are GC'd.
- `.rvt`/`.nwd` uploaded → rejected at the API with "Export to IFC" guidance (extension + magic-byte check).
- Corrupt/invalid IFC → conversion job catches, marks version `Failed` with reason; never crashes the worker; surfaced in UI.
- Huge model OOM in browser → we load `.frag` (not raw IFC) and convert server-side; set a soft size cap + warn; consider tiling/streaming for the largest models (deferred).
- Model re-version invalidates linked issues → issues anchor to **IFC GUID** (stable across re-export), not expressID; on re-version, GUIDs that no longer exist are flagged "element missing in current version" rather than silently broken.
- Coordinate-system mismatch / georeferencing → store `position` as a fallback; rely on GUID primarily.
- Server-side IFC parse memory on a 2 GB model → run conversion in a constrained worker, stream where possible, fail gracefully with a size cap for v1.

**Cross-cutting**
- New `rfis`/`bim` resources missing from a preset → automated test (preset keys ⊆ statement keys) blocks the regression.
- Suites backbone not yet shipped → gate on `project_type` + feature flag now, swap to `requireProjectSuite` later.
- Seeding at project creation fails → best-effort, never blocks creation (mirrors land-docs).

---

## Sequencing (incrementally shippable)

1. **M1 — RFI core**: `20260701_rfis.ts`, module (3-layer), RBAC additions + preset test, routes, frontend page mirroring queries, ball-in-court + official response + numbering + audit. (No external email yet.) Ships standalone value.
2. **M2 — RFI external + change link**: distribution list, public token reply route, reminders job, convert-to-change. 
3. **M3 — BIM upload + convert + view**: presigned S3 upload helper, `20260702_bim.ts`, conversion job (web-ifc/ThatOpen in Node), lazy viewer page, `.frag` load. IFC-only.
4. **M4 — BIM issues + RFI↔BIM links**: coordination issues, GUID anchoring, promote-to-RFI, RFI "Related To" BIM objects.
5. **M5 — Onboarding + owner portal wiring**: faction sign-up branches, wizard "existing assets" seeding (best-effort), owner-portal RFI/BIM read-only surfaces + `rfis.visibility` scoping.
6. **Later**: clash detection, federation UI, APS/native `.rvt` path, AR/takeoff.

Dependency order is correct: RBAC + RFI core before links; BIM viewer before BIM issues; both before portal surfacing.

---

## Adversarial critique (folded in above)

Reviewed via three lenses — feasibility, integration correctness, scope/edges. Blockers and majors are resolved inline in the design; listed here for traceability.

### Blockers (resolved)
- **C-1 RFI numbering race** — `MAX+1` in app code duplicates numbers under load. **Fix:** `rfi_counters` row `SELECT … FOR UPDATE` in the create tx + `UNIQUE(project_id, number)`. (§RFI numbering)
- **C-2 Permission-catalog omission** — adding `rfis`/`bim` to `statement` but not to presets gives every existing role **zero** actions → feature invisible/broken. **Fix:** add to all presets in the same PR + a test asserting preset keys ⊆ statement keys. (§Cross-cutting)
- **C-7 Large BIM upload via 25 MB route** — the buffered `@fastify/multipart` route (`fileSize` 25 MB, `files:5`) cannot take 50 MB–2 GB models, and the brief's "replace local disk" premise is wrong (storage is already S3). **Fix:** presigned direct-to-S3 PUT/multipart, bypassing the API body. (§BIM pipeline)

### Majors (resolved)
- **C-3 Ball-in-court on removed participant / reopen loops** — dangling assignee + unbounded reopen. **Fix:** reassign-to-manager on participant removal + `reopened_count` + full `rfi_events` audit. (§Ball-in-court, §Edge cases)
- **C-4 External email reply security** — spoofing/replay/unilateral close. **Fix:** single-use hashed expiring tokens, proposed-only external replies, neutral-fail, rate-limit. (§External email reply)
- **C-5 Notification CHECK constraint** — adding RFI notification types without extending `notifications_type_check` (migration `20260622`) fails at runtime. **Fix:** the RFI migration extends the CHECK with the new types. (§Cross-cutting, §How this ties in)
- **C-6 BIM re-version invalidates element anchors** — expressIDs change across exports. **Fix:** anchor issues/RFIs to IFC **GUID**; flag missing GUIDs on re-version; element index keyed by GUID. (§BIM pipeline, §Edge cases)
- **C — Owner-portal leakage** — hiding internal RFIs/markups only in the UI leaks via the API. **Fix:** `rfis.visibility` column + service-level `WHERE` scoping in `computeAccess`/RFI service; finances already exclude markups in the owner view. (§Owner portal)
- **C — Onboarding seeding blocking creation** — seeding BIM/docs inline could fail project creation. **Fix:** reuse the existing best-effort, non-blocking `uploadLandDocuments` pattern; BIM via presigned path. (§Onboarding b)

### Scope / YAGNI cuts for v1
- Defer clash detection, AR, 3D takeoff, 2D validation, native `.rvt`/`.nwd` (APS), model federation UI, in-browser 2 GB conversion. v1 BIM is **IFC-only, server-converted to fragments, view + GUID-anchored issues**.
- xeokit rejected on **AGPL** grounds; APS deferred on **cost + cloud lock-in**. ThatOpen/web-ifc chosen for permissive license + self-hosting + GUID mapping.

---

## Open questions for review

1. BuildPanda Consulting "managing org": dedicated org row + `projects.managed_by_org_id`, or a `managed` flag + convention? (Affects the owner faction auto-association.)
2. Element index: persist `bim_elements` in Postgres (searchable) vs JSON sidecar in S3 (cheaper) — decide once typical model sizes are known.
3. Is the suites backbone (`project_type`) expected to ship **before** this? If not, confirm the feature-flag interim gate.
4. Server-side IFC→fragments memory ceiling: acceptable max model size for v1 (e.g. cap at 500 MB IFC) before we invest in streaming/tiling?

---

## Addendum — Fully editable Project Chart (Gantt) with undo/redo

> Added 2026-06-14 per request. Separate milestone (M6), sequenced after RFI/BIM.

### Goal

Make the Schedules-section Project Chart (`packages/frontend/src/pages/project/schedule.tsx`, SVAR React Gantt v2.6.1) **fully editable** — drag/resize bars, edit task fields, create/delete dependency links, add/delete/reorder tasks — with edits **persisted** and **propagated to connected data** (phases/stages, key dates, finances views), plus **undo/redo** and the usual editing affordances (toolbar, inline editor, hotkeys).

### Verified grounding

- **Frontend** today renders the Gantt **read-only** from `useProjectActivities`. SVAR supports editing by dropping `readonly`, exposing `api` via `init`/`ref`, and listening to events: `update-task`, `add-task`, `delete-task`, `update-link`, `add-link`, `delete-link`, `drag-task`, `move-task` (reorder).
- **Backend** `modules/activities/` already has **full CRUD** — `POST/PATCH/DELETE /projects/:id/activities`, a reorder endpoint, and delay endpoints. So most mutation API exists; gaps: dependency-link persistence and batch updates for cascade.
- **Connected data**: activities ↔ `project_phases`/`stages` ↔ `key_dates` ↔ finances. The programme importer already derives phase date-ranges + key dates from activity dates — the **same derivation must run on edit** so the dashboard timeline, phases, and key dates stay consistent.

### ⚠️ Critical constraint (verified)

**SVAR Gantt undo/redo is PRO Edition only** (`undo` prop requires the paid license). The installed package is the free edition. Two paths — a decision is required:

1. **Buy SVAR PRO** → `undo` prop + `Ctrl+Z`/`Ctrl+Y` + toolbar buttons work out of the box. Least engineering, has a license cost.
2. **Custom undo/redo** (free edition) → maintain a client-side edit history stack; each Gantt event pushes an inverse operation; undo/redo replays against the existing activity CRUD API (optimistic, with server reconciliation). More code, no license cost, full control.

### Design (assuming custom undo path; adjust if PRO is purchased)

- **Enable editing**: `readonly={false}`, expose `api` via `init`, mount the SVAR `Editor` (sidebar, `autoSave`) + `Toolbar`.
- **Persist edits**: an `useScheduleEditor` hook subscribes to `api.on("update-task"|"add-task"|"delete-task"|"move-task"|...-link")` and calls the activities react-query mutations (PATCH/POST/DELETE/reorder). Debounce drag streams; commit on drop. Optimistic cache update + invalidate on settle.
- **Dependency links**: persist `ILink`s. Add a backend `activity_dependencies` table + endpoints (the `programme` import already parses 74 deps, so the data model should match the importer's link shape — reuse it).
- **Cascade to connected data**: on activity date/structure change, re-run the existing phase-date-span + key-date derivation (already in `panda-ai/programme/apply.ts` — extract the pure helpers and call them from an activities service hook) so `project_phases.date_range`, `key_dates`, and the dashboard timeline update. Wrap multi-row cascade in a transaction.
- **Undo/redo (custom)**: `useEditHistory` — a bounded stack of `{ do, undo }` ops; toolbar Undo/Redo + `Ctrl+Z`/`Ctrl+Y` (guard against editing an input). Each persisted mutation registers its inverse. Cap history (e.g. 50). Reconcile with server truth after each op.
- **Affordances**: toolbar (add/indent/outdent/zoom/undo/redo/export), inline grid cell editors, the task Editor dialog, multi-select + bulk delete, keyboard hotkeys, auto-scheduling toggle (SVAR `schedule-tasks`), unsaved-state indicator, conflict handling on concurrent edits.

### Edge cases

- Concurrent edits by two users → optimistic + last-write reconcile + invalidate; surface "schedule changed, refresh".
- Drag creates an invalid dependency (cycle) → SVAR `api.intercept("add-link")` blocks cycles before persist.
- Edit while a programme import is mid-apply → lock/disable editing during import jobs.
- Undo across a cascade (one drag moved a phase + 3 key dates) → the inverse op must restore all cascaded rows (transactional snapshot).
- Permission: editing requires `schedule:manage`; read-only roles (client/viewer) keep `readonly={true}`.
- Reorder vs reparent (indent) both fire `drag-task`/`move-task` — distinguish via event params (`top` vs `parent`).

### Milestone M6 sequence

1. Backend: `activity_dependencies` table + endpoints; extract phase/key-date derivation into reusable service helpers; batch/transactional cascade endpoint.
2. Frontend: enable SVAR editing (`readonly` off, `api`, `Editor`, `Toolbar`); `useScheduleEditor` persistence; optimistic react-query wiring.
3. Frontend: custom `useEditHistory` undo/redo (or wire SVAR PRO `undo` if licensed) + toolbar/hotkeys.
4. Cascade: re-derive phases/key-dates/timeline on edit; verify dashboard timeline + Finance Milestones update.
5. Guards: `schedule:manage` gating, import-lock, cycle interception, concurrency reconcile.
6. Verify: Playwright — drag a bar → persists + dashboard timeline updates; create dependency; undo/redo; read-only role cannot edit.

### Open question

- **SVAR PRO license vs custom undo/redo?** This is the single biggest scoping decision for M6 (undo/redo is explicitly PRO-only). Recommend custom undo if avoiding the license; otherwise PRO is far less work.

