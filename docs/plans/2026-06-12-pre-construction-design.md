# Design: Pre-construction Suite — Leads, Proposals & the path into Construction

Status: Draft for review — no code yet.
Date: 2026-06-12 (rev 2 — suite-based IA modeled on ernest's Growth/Office split)

## 1. Problem & goals

BuildPanda starts at "project exists". Everything before that — a homeowner
looking for a contractor, a contractor quoting a job, an architect issuing
drawings and a bill of quantities for pricing — happens off-platform.
ernest-api solves this with a separate **Growth suite** (Proposal Management)
sitting beside its **Office/PM suite**, with an app switcher between them. We
adopt the same shape.

Goals:
1. **Two suites**: a Pre-Construction suite and the existing Construction
   workspace, with a suite switcher (ernest: `/select/app` + header popover).
2. Each pre-construction deal is a **workspace, not a form** — tabs for
   details, plans/drawings, bill of quantities, priced estimates, conversation
   and an activity timeline (ernest's bid detail: Project Details / Plans /
   Quotes / Proposals / RFIs / Archive).
3. **Busy, insight-dense dashboards** in both suites (ernest: metric cards +
   tabbed tables/charts).
4. An accepted proposal **converts into a Construction project** with budget,
   stages, milestone payment schedule and documents seeded (ernest's
   ConvertBidModal → toast → "Go to Project").
5. Architect flow: plans + unpriced BoQ live in the workspace; the
   **contractor still prices it** (architect owns scope, contractor owns
   rates, homeowner decides).
6. Zero per-contractor email setup — outbound only via platform ZeptoMail.

Non-goals (this phase): contracts module (accepted estimate + payment schedule
+ acceptance event is the contract-of-record; PDF later), multi-contractor
tender comparison UI (model supports it), payment gateway, mailbox
integration, ernest's trade-specific tooling (scope sheets, feeder schedules,
HVAC/electrical brand tables, HubSpot).

## 2. What exists today (anchors)

- Conversion targets (stable, tsc clean): `projects` (budget, currency),
  `project_phases`, `budget_phases`, `milestone_payments` (escrow, inspector
  sign-off), payment ledger, documents w/ versioning, files (S3).
- `project_participants` roles include **architect**; token-invite pattern
  (7-day expiry). `user.accountType`: `project_owner | construction_company |
  project_manager` (inert today — used here to branch onboarding/suites).
- `POST /leads/consultation` (public) — emails the lead via ZeptoMail, nothing
  persisted yet. Branded email templates in `lib/email-templates.ts`.
- Frontend shells: workspace `sidebar.tsx` (Dashboard/Project/Document/
  Finance/Settings) and `project-sidebar.tsx` (grouped project nav). The
  issue-tracker module shape (list + status + comments) is reused 8×.

## 3. Information architecture — suites

```
 Suite switcher (logo popover, ernest-style)        accountType default
 ├─ 🏗  Construction            (existing workspace) ← all
 ├─ 📐 Pre-Construction         (new suite)          ← construction_company
 └─ 🛠  Admin Panel              (existing, admins)
```

**Pre-Construction suite sidebar** (own layout, like ernest's GrowthLayout):

```
 Dashboard          ← busy insights (see §7)
 Leads              ← intake inbox: marketing form, homeowner requests, manual
 Proposals          ← THE pipeline (kanban | table toggle)
 Settings           ← estimate defaults: company profile on proposals, T&Cs
```

Homeowners never see this suite; their side is the public token proposal page
and a "My estimates" section in the portal. The Construction suite is
unchanged — no pre-construction status on projects, no phantom projects.

## 3.1 Suite switcher & seamless navigation

Constraint check: no framer-motion in deps; react-router-dom 7 (View
Transitions support) + Tailwind v4 transitions + @base-ui popover are already
available — **no new dependencies**.

- **One persistent app shell** hosts both suites; switching swaps the sidebar
  *content*, never remounts the shell. Sidebar panel slides/fades via CSS
  transitions (`transition-transform/opacity`, ~200ms, `prefers-reduced-
  motion` respected); the content area cross-fades using the View Transitions
  API via react-router's `viewTransition` (progressive enhancement — falls
  back to instant swap).
- **Switcher UI** (ernest's header-popover pattern): logo button in the
  sidebar header opens a popover listing suites with icon + one-line
  description (Construction / Pre-Construction / Admin for admins).
  Keyboard accessible; current suite checked.
- **URL is the source of truth**: pre-construction routes live under
  `/sales/*` (`/sales`, `/sales/leads`, `/sales/proposals/:id/:tab`);
  deep links work without the switcher. Last-used suite persisted to
  localStorage and used by HomeRedirect for company users.
- Cross-suite jumps (conversion's "Go to project", a proposal's link to its
  converted project) animate the same way — suite changes are a transition,
  not a context loss.

## 4. The Proposal workspace (one deal = one workspace)

The core entity is a **Proposal** (ernest's "bid"; pipeline statuses:
`New → Preparing → Sent → UnderReview → Revising → Accepted → Converted | Lost
| Expired`). Opening one shows an ernest-style tabbed workspace:

```
 Ife Terrace — Mrs. Folake A.            [status: Sent ▾]   [Send] [⋯]
 Ibadan, Oyo · ₦48.5M · valid until 30 Jun
 ┌──────────┬────────────────┬──────┬──────────┬──────────┐
 │ Overview │ Plans & Drawings│ BoQ  │ Estimate │ Messages │
 └──────────┴────────────────┴──────┴──────────┴──────────┘
 ... tab content ...                      │ Recent Activity
                                          │ ● Folake viewed estimate · 2h
                                          │ ● Rev 2 sent · yesterday
                                          │ ● BoQ uploaded by architect
```

- **Overview** — client details, source lead, brief, key facts (location,
  plot, project type), team (estimator), the **"Start this build"** conversion
  card (appears when Accepted; ernest's "Convert Bid to a Project" grid), and
  the persistent **Recent Activity** timeline (`proposal_events`).
- **Plans & Drawings** — file list (plans, drawings, BoQ docs, site photos)
  on the files module; upload by company, homeowner or architect collaborator.
- **BoQ** — structured unpriced scope: group / description / qty / unit.
  Authored by the architect (or imported), editable until priced. This is the
  architect's tab; rates never appear here.
- **Estimate** — the priced document: line items seeded from BoQ (qty/unit
  locked when BoQ-sourced) + contractor's own groups, rates, contingency %,
  totals, **payment schedule** (% milestones), revision history (Rev 1, 2…
  supersession), Send / share-token state, accepted/declined record.
- **Messages** — comment thread with the homeowner/architect (in-app; emails
  are notifications deep-linking here).

Collaborators: the homeowner and optionally an architect are attached to the
proposal by email invite (token), before any account/org exists — mirroring
participant invites. The architect can edit Plans & BoQ tabs only.

## 4.1 The contractor ↔ owner dynamic (mirrors the portal design)

Same rule as `2026-06-01-owner-vs-company-portal-design.md`, one phase
earlier: **the company owns the workspace; the homeowner is a scoped
participant with real power only over what is genuinely theirs.**

- The proposal (pipeline, internal notes, dashboard) belongs to the
  contractor's org. Homeowners never see the suite.
- The homeowner is a **collaborator on one proposal** (token invite, same
  pattern as project participants). Their powers are the pre-construction
  analogues of their construction powers:
  accept/decline estimate (≈ approvals), comment/request changes (≈ queries),
  view proposal/plans/BoQ/revisions (≈ portal), **agree the payment
  schedule** (≈ milestone releases). Architect = collaborator + edit rights
  on Plans & BoQ only (≈ inspector's scoped sign-off power).
- **Continuity spine:** the payment schedule the homeowner accepts becomes
  the `milestone_payments` they control in construction — agreed terms flow
  into escrow without re-entry; the accepted estimate is the cross-linked
  contract of record. BuildPanda is the neutral trust layer on both sides of
  the handshake.
- Either side initiates (contractor: lead → proposal → invite; homeowner:
  describe build → invite contractor/architect) — both converge on the same
  workspace. Tender case: one homeowner ↔ many contractors' proposals, each
  in its own org; my-build aggregates the homeowner's proposals; contractors
  never see each other.
- Mutual transparency about actions, not workspaces: contractor sees
  engagement events (viewed, no-reply); homeowner sees revision diffs and
  history.

## 4.2 The homeowner lens — a journey, not a suite

Homeowners never see Pre-Construction, pipelines or workspaces. Same objects,
different lens: the owner's UI is a **journey stepper** —
`Explore → Consult → Estimate → Agreement → Building → Handover` — shown on
one journey card in my-build.

- **First-run = three doors** (not jargon): "I'm just getting started" /
  "I already have a contractor or architect" / "My build is already
  underway". Door 1 is a wizard where every question has "not sure yet";
  output is a *brief*, not a BoQ.
- **BuildPanda-as-builder:** BuildPanda operates its own org on the platform.
  "I'm just getting started" leads route to BuildPanda advisors (the org-null
  consultation leads get **adopted** into the BuildPanda org), who run the
  same Pre-Construction suite as any contractor. No special code path —
  dogfooding.
- **Owner's proposal page = one scrollable document** (not tabs): totals,
  grouped line items, payment schedule framed as escrow protection ("you
  release money only when work is verified"), attached plans, comment box,
  Request changes / Accept. Token link, no login wall; acceptance = typed
  name + plain-language "this becomes your agreement" confirmation.
- Waiting states are reassurance, not metrics: what happened, what happens
  next, expected response time; educational content while waiting.
- Architect activity surfaces to the owner as journey milestones ("Your
  architect added drawings ✓"), never as a file workspace.
- After conversion: celebration state → existing my-build portal, escrow
  milestones pre-agreed, the estimate persists as "Your agreement".

## 4.3 Company profile (prerequisite for professional proposals)

System tie-in: the better-auth `organization` table already has unused `logo`
and `metadata` columns; teams are managed in dashboard settings. Proposals,
proposal emails ("<Company> via BuildPanda") and later invoices all need a
real company identity — so we extend the org with typed columns (queryable,
not JSON-in-metadata; better-auth ignores extra columns):

`organization` + `phone`, `address`, `contact_email`, `website`,
`default_currency` (NGN), `default_tax_label`, `default_tax_pct`
(NG default: "VAT", 7.5).

- Edited in the Pre-Construction suite's **Settings** page (logo upload via
  files module) and linked from existing team settings.
- Read by: proposal documents/PDF-later, the owner's proposal page header,
  outbound email display name, estimate tax defaults.
- Contractor onboarding's mini-setup (§9) writes exactly these fields.

## 4.4 Versioning, identity & tax (generic, global-ready)

- **Proposal identity:** per-org sequential `number` (`BP-0012` style,
  org-scoped counter) so revisions have a stable reference: "Proposal
  BP-0012 · Rev 2". Allocated at creation, never reused.
- **Revision immutability:** a Sent estimate revision is frozen. Editing
  creates the next `revision_no` as Draft; sending it marks the previous one
  `Superseded` and logs a `revised` event whose metadata captures the deltas
  (old/new totals). Contractor writes a required `change_note` ("Roofing
  sheets switched to imported aluminium") — the owner's page shows revision
  history with what changed and why (mutual-transparency rule, §4.1). Mirrors
  the documents module's versioning precedent (`20260608_document_versions`).
- **Tax, not VAT:** estimates carry `tax_label` + `tax_pct` (free label:
  VAT/GST/Sales Tax/none), defaulted from the org profile. Totals pipeline:
  items subtotal → + contingency % → + tax % → grand total; the tax row is
  hidden when pct = 0. Currency stays per-proposal. Conversion uses the grand
  total as `projects.budget_total`; the payment schedule's percentages apply
  to the grand total.

## 5. Data model

- `leads` — org_id (nullable: null = platform/marketing leads → admin panel),
  name, email, phone, location, project_type, message, source, status
  (`New | Contacted | Qualified | ProposalOpened | Won | Lost`), assigned_to,
  notes. "Open proposal" from a lead links `proposals.lead_id`.
- `organization` (extended) — + phone, address, contact_email, website,
  default_currency, default_tax_label, default_tax_pct (see §4.3).
- `proposals` — org_id, lead_id?, project_id? (set on conversion), `number`
  (per-org sequence), title, client_name/email/phone, location, brief,
  status (pipeline above), currency, valid_until, created_by, timestamps.
- `proposal_collaborators` — proposal_id, email, role (`homeowner |
  architect`), invite_token/expiry, user_id? (linked after sign-up).
- `proposal_files` — proposal_id, file_id, kind (`plan | drawing | boq |
  photo | other`), uploaded_by.
- `proposal_boq_items` — proposal_id, group_label, description, qty, unit,
  sort. (Unpriced scope.)
- `estimates` — proposal_id, revision_no, status (`Draft | Sent | Accepted |
  Declined | Superseded | Expired`), contingency_pct, tax_label, tax_pct,
  change_note (required from rev 2 on), subtotal/tax_amount/total
  (denormalised), share_token + expiry, sent_at, accepted_at/by_name. One
  active revision per proposal; Sent revisions are immutable (§4.4).
- `estimate_items` — estimate_id, group_label (→ stage name), description,
  qty, unit, unit_rate, total, boq_item_id? (locks qty/unit when set), sort.
- `estimate_payment_schedule` — estimate_id, label, percent (Σ=100),
  description, sort. (→ `milestone_payments`.)
- `proposal_events` — proposal_id, type (`created | file_added | boq_updated |
  estimate_sent | viewed | commented | revised | accepted | declined |
  converted`), actor, metadata, created_at. (Activity timeline + audit.)
- `proposal_comments` — standard comment shape.

## 6. API surface

Company (org-scoped): `GET/POST/PATCH /leads`;
`GET/POST/PATCH/DELETE /proposals` (+ `?status=` for pipeline);
sub-resources: `/proposals/:id/files | boq-items | collaborators | comments |
events`; `POST /proposals/:id/estimates` (new revision, optional
`?fromBoq=true` seeding), `PUT /estimates/:id/items|payment-schedule`,
`POST /estimates/:id/send`, `POST /proposals/:id/convert` (transactional:
project + phases + budget_phases + milestone_payments + client/architect
participants + documents copy + lead → Won + status → Converted).
`GET /pre-construction/insights` (dashboard aggregates).

Public (token): `GET /proposal-view/:token` (logs `viewed`),
`POST /proposal-view/:token/accept | decline | comments`. Existing
`POST /leads/consultation` also inserts an org-null lead row.

## 7. Dashboards — busy by design (ernest's insights pattern)

**Pre-Construction dashboard** (suite home):

```
 ┌─ Pipeline value ─┬─ Awaiting reply ─┬─ Win rate 90d ─┬─ Avg. response ─┐
 │ ₦184M (7 open)   │ 3 proposals      │ 42%            │ 2.1 days        │
 ├──────────────────┴──────────┬───────┴────────────────┴─────────────────┤
 │ Pipeline by status (funnel) │  Needs attention                         │
 │ New 4 ▸ Preparing 2 ▸ Sent 3│  ⚠ #12 Ajah expires in 3 days            │
 │ ▸ Review 1 ▸ Accepted 1     │  ⚠ #14 viewed 4× — no reply, nudge?      │
 ├─────────────────────────────┤  ● Lead "Lekki duplex" unassigned 2d     │
 │ Won value by month (bar)    │  Recent activity (cross-proposal feed)   │
 └─────────────────────────────┴──────────────────────────────────────────┘
```

Cards: pipeline value, proposals awaiting reply, win rate, avg response time,
leads this month, accepted-not-converted. Panels: status funnel with counts,
monthly won-value chart, "needs attention" (expiring validity, viewed-but-
silent, unassigned leads), cross-proposal activity feed.

**Construction dashboard** gets the same treatment in a later slice (portfolio
cards: active builds / at-risk / escrow held vs released / open approvals &
queries / key dates at risk + per-project health strip) — tracked here so the
"busy dashboard" standard applies platform-wide, built after the suite ships.

## 7.2 Expiry & validity automation

System constraint (verified): `QueueManager` supports one-shot `enqueue` only
— no repeatable/cron jobs — and falls back to `setImmediate` inline execution
when Redis is absent. Therefore correctness must not depend on a scheduler:

- **Lazy effective status (always correct):** any read path that returns a
  Sent estimate past `valid_until` presents — and persists — it as `Expired`
  (proposal status follows). Works with zero infrastructure; an expired
  proposal can be revived by issuing a new revision with a new validity.
- **Proactive sweep (best-effort, adds nudges):** extend QueueManager with
  `scheduleRepeatable` — BullMQ repeatable job (daily) in redis mode, a
  plain `setInterval` timer in inline mode (single-instance deployment, so
  this is safe). The sweep: flips overdue Sent → Expired, emails the company
  ("Proposal BP-0012 expired"), and sends the *expiring-in-3-days* and
  *viewed-but-silent* nudges that feed the dashboard's "needs attention"
  panel. All emails via the existing ZeptoMail templates; in-app rows via the
  notifications module.
- Token links and `valid_until` are independent: an expired estimate's page
  still renders (read-only, "this estimate has expired — ask <company> for
  an updated one") rather than 404ing — owners often open old emails.

## 7.3 Lead adoption (platform → organization)

Marketing-site consultation leads persist with `org_id = null` and surface in
the **admin panel** (existing `/admin` gate + repo pattern). Adoption flow:

- `GET /admin/leads` (filterable) and `POST /admin/leads/:id/assign`
  `{ organizationId }` — sets `org_id`, stamps `adopted_by/at` in the lead's
  history, after which the lead appears in that org's Pre-Construction Leads
  pipeline like any other.
- Primary use: assigning "BuildPanda builds it for me" enquiries to the
  BuildPanda org (§4.2 dogfooding); also covers routing a lead to a partner
  contractor later.
- packages/admin gets a **Leads** screen (list + assign dialog with org
  picker). Unassigned-leads count joins the admin overview card.

## 8. Conversion UX (Pre-Construction → Construction)

Ernest: convert button on bid details → modal → toast "Bid converted" with
"Go to Project" → lands in the Office suite. Ours, same beats:

1. Estimate accepted (homeowner, via token page) → proposal status Accepted,
   email + in-app notification, Overview tab shows **"Start this build"** card.
2. Click → **conversion review** (pre-filled project wizard): name/location,
   budget = estimate total, client participant = acceptor, architect carried
   over (optional), preview of stages ← item groups, budget allocation ←
   group subtotals, milestone payments ← payment schedule, documents ← plan
   files. Everything editable before confirm.
3. Confirm → single transaction → success toast **"Project created — Go to
   project"** → navigates into the **Construction suite** project Overview.
4. Proposal becomes read-only `Converted`, cross-linked both ways (contract
   of record). Lead → Won. Homeowner's token page → "Your build has started"
   → portal.

## 9. Onboarding & email (unchanged from rev 1)

- First-run branches on `accountType`: companies → Pre-Construction suite,
  "Create your first proposal" (escape hatch: existing project wizard);
  homeowners → "Describe your build & invite your contractor" (creates a
  proposal shell + collaborator invite — the acquisition loop).
- Email is **outbound-only via platform ZeptoMail**: `"<Company> via
  BuildPanda" <noreply@buildpanda.io>`, Reply-To = contractor. No mailbox
  integration ever. Later: `reply+<token>@` inbound parsing, white-label.

## 10. Build slices

1. **Leads + suite shell** — leads migration, persist in existing endpoint;
   persistent app-shell switcher with animated suite swap (§3.1, `/sales/*`
   routes); Leads page; **admin lead adoption** (§7.3: /admin/leads list +
   assign-to-org UI).
2. **Company profile + proposal workspace core** — org profile columns +
   suite Settings page (§4.3); proposals (per-org numbering) / collaborators
   / events tables; pipeline page (table first, kanban after); workspace
   shell with Overview + Estimate tabs — items, payment schedule,
   contingency + generic tax (§4.4), revision chain with immutability and
   change_note.
3. **Send + public proposal page** — token, accept/decline, viewed events,
   Messages tab, ZeptoMail templates (sent / accepted / declined / change
   requested); **expiry automation**: lazy effective status +
   `scheduleRepeatable` sweep with expiring/nudge emails (§7.2).
4. **Convert** — conversion review + transaction + cross-links; "two doors"
   on Construction "New project"; animated cross-suite handoff.
5. **Plans & BoQ tabs (architect flow)** — files kinds, BoQ editor,
   architect collaborator permissions, estimate-from-BoQ seeding.
6. **Pre-Construction dashboard** — insights endpoint + busy dashboard
   (consumes the §7.2 nudge/expiry signals for "needs attention").
7. **Onboarding branches**; then later: kanban polish, tender comparison,
   PDF export, contracts, Construction portfolio dashboard, inbound replies.

Slices 1–3 touch nothing existing; slice 4 writes into finances/stages
(targets verified stable). Each slice ships as one full backend+frontend+
verify unit, per the established workflow.
