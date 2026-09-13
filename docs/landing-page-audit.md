# Landing page audit — buildpanda.io vs. the product

**Date:** 13 September 2026
**Site audited:** `packages/web` (Next.js) — all 9 routes, every copy-bearing component
**Product audited:** `packages/frontend`, `packages/backend`, `packages/admin`, `packages/mobile`
**Nothing was changed.** This is a read-only audit.

---

## Headline

The site sells a **diaspora home-building service with a progress dashboard**. The
product is a **contract administration system for commercial and civils
contractors**, plus a **pre-construction suite**, plus a **platform-operated
independent inspection service**. These are not the same product.

**23 stale or wrong claims** are catalogued below. Two of them are not merely
stale, they are hazardous:

1. The site says six times that BuildPanda **moves money**. It does not, has never
   done, and the site's own Terms of Service say so in the opposite direction.
2. The site runs a **full homepage section plus two videos on drone monitoring**.
   There is no drone feature anywhere in the product — zero references in the
   entire backend.

Everything the product gained in the last three months — RFIs, change orders,
extensions of time, delays with culpability, the certification waterfall,
procurement deliveries, the civils library, the inspection service, the admin
app, the mobile field app, Panda AI — is **absent from the site entirely**.

---

## 1. Claims that are now wrong or stale

### 1.1 "Money is released" — the site claims a payment rail that does not exist

**Six separate instances.** This is the single most important finding.

> "Milestone payments — **Money is released against verified progress**, tying
> funds directly to completed work."
> — `packages/web/app/page.tsx:64-67`

> "**Funds move only when verified work is signed off.**"
> — `packages/web/components/hero-visual.tsx:69`

> "BuildPanda gives you a live window into your project and **ensures your money
> only moves when verified work is complete**."
> — `packages/web/app/for-owners/page.tsx:81-84`

> "No more wasted funds — **Payments are linked to verified milestones, so money
> follows the work.**"
> — `packages/web/app/page.tsx:197`

> "**Funds are released milestone by milestone**, only after independent
> inspectors sign the work off. **Every naira stays tied to progress you can
> see.**"
> — `packages/web/app/construction/page.tsx:114`

> "Payments released only against verified progress"
> — `packages/web/app/construction/page.tsx:65`, and again as
> `DarkPoint` on `app/page.tsx:272` and `Belief` on `app/about/page.tsx:103`

**What is actually true.** BuildPanda is a construction *bookkeeping* system.
Money never passes through it. There is no payment processor, gateway, webhook,
escrow provider or bank integration anywhere in the codebase — no Stripe,
Paystack, Flutterwave or Plaid SDK, no `PAYMENT_*` config. `funds_deposited`,
`locked_in_escrow` and `remaining_balance` are **tracked figures**;
`payment_ledger` and `finance_events` are **audit trails**; "escrow" is a
computed number, not an account. `deposit` and `releaseMilestone` in
`packages/backend/src/modules/finances/` are pure Knex writes. "Record payment"
and "Release" **log**; they never charge or move funds.

**The site already contradicts itself.** Its own Terms of Service page says:

> "BuildPanda **is not a bank, escrow agent, payment institution or financial
> services provider, and does not hold, transfer or guarantee funds** on behalf
> of any party… Where the platform records a milestone payment as 'released' or
> 'verified', **this reflects the status recorded by users within the platform
> and does not constitute a legal release of funds or a guarantee of payment.
> Actual fund transfers occur through your chosen payment method outside the
> platform.**"
> — `packages/web/lib/legal.ts:195-196`

The marketing pages promise exactly what the contract disclaims. A client who
signs up expecting BuildPanda to hold their money has been misled by the
homepage and corrected only by clause 8 of the ToS.

**Proof:** `packages/backend/src/modules/finances/service.ts`,
`packages/web/lib/legal.ts:195-196`, `CLAUDE.md` "Money is logged, not
transacted".

---

### 1.2 "Drone monitoring" — an entire homepage section for a feature that does not exist

**Claim (a) — a dedicated homepage section with two autoplaying videos:**

> Eyebrow: "**Drone monitoring**" · Title: "**See your site from the sky, every
> week**" · "**High-resolution drone surveys give you an honest, time-stamped
> view of progress on the ground.**" · Captions: "Structure rising, block by
> block" / "Inspections and progress, verified on site"
> — `packages/web/app/page.tsx:136-176`, serving `/drone-survey-1.mp4` and
> `/drone-survey-2.mp4`

**Claim (b) — a feature card, twice:**

> "**On-site & drone monitoring** — Photos, daily logs, and **drone footage**
> bring the site directly to your screen."
> — `packages/web/app/page.tsx:74-77` and `app/for-owners/page.tsx:31-35`
> ("high-resolution drone surveys")

**Claim (c) — a delivery-phase promise:**

> "Daily logs, photos and **drone monitoring**"
> — `packages/web/app/construction/page.tsx:45`

**What is actually true.** The word "drone" appears in **zero** backend files.
In the frontend it appears in exactly one place: a checkbox in the
project-creation wizard.

> `{ id: "drone-monitoring", title: "Drone Monitoring", description: "Weekly
> high-resolution aerial photos and videos of your construction site." }`
> — `packages/frontend/src/components/molecules/management-step.tsx:62-69`

That toggle records a stated preference at project setup. Nothing schedules a
flight, ingests a survey, stores it, or shows it. There is no drone capture, no
drone storage, no drone timeline, no drone review. The product's actual visual
surfaces are **"Media library — Site photos & videos"** and **"Daily log — Field
reports"** (`packages/frontend/src/components/organisms/project-sidebar/constants.tsx:146,148`).

The videos on the site are real drone footage of a real site — but they document
a *service BuildPanda's people performed*, not a *capability the product has*.

---

### 1.3 "Independent inspections" — right idea, wrong mechanism, and badly undersold

> "**Independent inspections** — Third-party quality checks **at each stage**
> give you an honest, professional view of the work on the ground."
> — `packages/web/app/for-owners/page.tsx:37-40`

> "**Quality assurance** — Independent, third-party inspectors check the work
> **at every stage**… **Third-party inspections per stage**"
> — `packages/web/app/construction/page.tsx:48-51`

> "Independent inspections at every stage" · "Independent inspections you can
> rely on" · "Independent inspections, not assumptions"
> — `app/construction/page.tsx:64`, `app/page.tsx:271`, `app/about/page.tsx:104`

**What is actually true, and it is better than the site says.** Inspections were
rebuilt in the last day into a **client-requested, platform-operated service**.
The model is explicit in the code:

> "Where the service order has got to. **An inspection is a job BuildPanda is
> asked to do, not a note the builder writes about itself**: it is requested,
> scheduled once an inspector is assigned, attended, then reported."
> `SERVICE_STATUSES = ["Requested", "Scheduled", "Attended", "Reported", "Cancelled"]`
> `REQUESTER_SIDES = ["client", "contractor"]` — "Which side of the contract asked."
> `inspectorUserId` — "**The BuildPanda inspector's user id** — null until one is assigned."
> `contractorName` — "**The party being inspected. The contractor is the subject, never the author.**"
> `feeAmount` — "**Recorded, never charged** — money is logged, not transacted."
> — `packages/backend/src/modules/inspections/types.ts:21-70`

BuildPanda runs a **service catalogue** and **assigns its own inspectors** from
the platform admin app:

> "**BuildPanda's service catalogue: the inspections the platform offers.**"
> — `packages/admin/src/pages/inspection-catalogue.tsx:19`
> Badge: "**Global catalogue · managed by BuildPanda**" (line 139)

> "**Assign a BuildPanda inspector**" — "Putting a BuildPanda inspector on a
> request. **This is the platform's own act.**"
> — `packages/admin/src/components/assign-inspector-dialog.tsx:8,48`

Admin pages `inspection-requests.tsx` and `inspection-catalogue.tsx` exist;
inspections carry `outcome` (pass/fail), `findings`, `reinspectionDate`,
`holdPoint`, and a category list that is admin-managed
(`packages/backend/src/modules/inspection-categories/`).

**Three things are stale about the site's version:**
1. **"at each stage" / "per stage"** promises automatic per-stage coverage. The
   product is **request-driven** — someone on the client or contractor side
   raises a request.
2. The site never says **who** the inspector is. The product now says plainly:
   a BuildPanda inspector, assigned by BuildPanda. That is the most defensible
   trust claim on the whole site and it is not being made.
3. The site never mentions that an inspection produces a **pass/fail verdict
   with findings, photos and a re-inspection date** — only "an honest,
   professional view".

---

### 1.4 "Milestones & schedule" — the product has a programme, not a checklist

**Three instances.**

> "**Milestones & schedule** — Break your build into **clear milestones** with a
> live schedule of what comes next."
> — `packages/web/app/page.tsx:59-62`, `app/for-contractors/page.tsx:53-57`,
> `app/for-owners/page.tsx:43-47`

The homepage hero visual reinforces it with a four-item milestone checklist:
Foundation / Substructure / Framing & roofing / Finishing & handover
(`packages/web/components/hero-visual.tsx:3-8`).

**What is actually true.** The schedule is no longer a list of milestones. The
Schedules group is:

> "**Build stages**" (Phases & progress) · "**Key dates**" (Milestone dates) ·
> "**Site activity**" (Work items) · "**Project chart**" (Gantt chart) ·
> "**Look aheads**" (Rolling look-ahead planning)
> — `packages/frontend/src/components/organisms/project-sidebar/constants.tsx:100-141`

Activities carry **predecessors with FS/SS/FF/SF logic and lag**, **percent
complete**, and a **working-day calendar** (`packages/backend/src/lib/working-days.ts`).
Key dates carry a **🔒 Contractual** flag and render "revised from" dates
(`packages/backend/src/db/migrations/20260928_contractual_key_dates.ts`). The word
"milestone" now survives almost exclusively in *finance*
(`MILESTONE_CLAIM_STATES = ["pending", "claimable", "claimed", "certified", "paid"]`,
`packages/backend/src/modules/finances/types.ts:8`).

A contractor reading "break your build into clear milestones" will assume there
is no critical path. There is.

---

### 1.5 "Budget & finances" — flattens a two-sided commercial model into one card

**Three instances.**

> "**Budget & finances** — Allocate budget, track expenses, and watch your spend
> against the plan."
> — `packages/web/app/page.tsx:69-72`, `app/for-contractors/page.tsx:65-69`,
> `app/for-owners/page.tsx:57-62`

**What is actually true.** Finance is now four surfaces with a permission split
that is the heart of the commercial model:

> "**Overview**" (Money position) · "**Contracts & phases**" (Contracts, terms &
> phase costs) · "**Expenses**" (Site spend & purchase orders) · "**Change
> orders**" (Scope changes) · "**Budget & invoices**" (Billing sheet, invoices &
> payments)
> — `packages/frontend/src/components/organisms/project-sidebar/constants.tsx:160-201`

And critically, in `packages/backend/src/lib/permissions.ts`:

> `finances:view` is the **client-facing contract position** (contract sum,
> certificates, retention); `finances:viewCosts` is the **contractor's internal
> position** (expenses, POs, budget vs actual, margin).

The Expenses nav entry is the only one in the whole sidebar gated on
`viewCosts` — that is deliberate: a client must never see the contractor's
margin. The site's single "watch your spend against the plan" card describes
neither side correctly and hides the one thing a contractor most wants to hear
(*my client cannot see my costs*).

Also missing from the site: **certification is distinguished from funding**.
Certified gross to date, still to certify, unpaid certified, **retention held**,
advance recovery from certificate
(`packages/backend/src/modules/finances/types.ts:87,106,127,323-324`) and
payment claims (`packages/backend/src/modules/payment-claims/`).

---

### 1.6 "Who we build for" and the lead form cannot accept a road contract

> "**Who we build for** — Whatever you are building, we manage it the same
> careful way": **New homes** · **Renovations** · **Investments**
> — `packages/web/app/construction/page.tsx:202-209`

> `projectTypes = ["Build a new home", "Renovate a property", "Invest in real
> estate", "Commercial project", "Other"]`
> — `packages/web/lib/site.ts:41-47` (drives the consultation form dropdown)

**What is actually true.** The product's own project-type step offers:

> "**Civil / Infrastructure**"
> — `packages/frontend/src/components/molecules/project-type-step.tsx:33`

and the product ships a complete **civils work-item library**:

> `{ id: "civils", label: "**Civils & roads**", standard: "**Road works**",
> description: "Highway and drainage work items — earthworks, sub-base,
> surfacing, kerbs, culverts and road furniture." }`
> — `packages/frontend/src/lib/work-items/index.ts:9-16`

70 items across 12 sections: Site clearance & preliminaries, Setting out &
survey, Earthworks & formation, Capping & sub-base, Base course, Bituminous
surfacing, Kerbs/footways & drainage channels, Drainage & culverts, Structures &
concrete works, Road furniture & markings, Traffic management & accommodation
works, Landscaping & reinstatement
(`packages/frontend/src/lib/work-items/civils.ts`). A road job is offered the
road library by default (`defaultLibraryForProjectType`). The building library
is NRM2.

A highway contractor arriving from an ad cannot select their own sector in the
site's lead form. The lead they submit lands in
`packages/backend/src/modules/leads/` with `project_type: "Other"`.

> **Note on the dogfood docs:** `docs/dogfood-2026-09-13/verification.md` records
> the civils library as an explicit **FAIL** ("still 16 NRM2 sections, no
> asphalt, no sub-base, no culvert"). That verification ran at 15:37 today and
> the library landed after it. The code is ahead of the report; I verified the
> library directly. Same applies to the inspection service and the retirement of
> queries/action items — all three postdate the verification run.

---

### 1.7 "A single advisor accountable for your project" — no such role exists

**Four instances.**

> "**A single advisor accountable for your project**" — `app/page.tsx:270`
> "A BuildPanda **advisor** responds within one business day." — `app/page.tsx:106`
> "Get regular updates from your **dedicated advisor**" — `components/onboarding-timeline.tsx:38`
> "A **dedicated advisor** who understands building in Nigeria" — `components/consultation-section.tsx:6`, `app/talk-to-us/page.tsx:14`

**What is actually true.** There is no "advisor" anywhere in the product.
`packages/backend/src/lib/role-presets.ts` defines 13 participant roles: `client`,
`project_manager`, `architect`, `inspector`, `guest`, `materials_requester`,
`materials_approver`, `resident_engineer`, `quantity_surveyor`, `site_agent`,
`surveyor`, `foreman`, `materials_engineer`. None is an advisor. A client
logging in sees a project team, not "their advisor". The promise is a human
service commitment with no product surface behind it — nowhere in the app does a
client see *who* their advisor is or message them as such.

---

### 1.8 "Vetted contractors" — no vetting feature exists

**Four instances.**

> "No more wrong contacts — Work with **vetted professionals**" — `app/page.tsx:198`
> "**Vetted, qualified contractors and professionals**" — `app/construction/page.tsx:63`
> "**Contractor selection and vetting**" — `app/construction/page.tsx:39`
> "**Verified contractors** and independent quality checks" — `components/consultation-section.tsx:8`, `app/talk-to-us/page.tsx:16`

**What is actually true.** There is no vetting workflow, contractor directory,
credential check, rating or approved-list feature. The nearest things are
`packages/backend/src/modules/suppliers/` (a **project-level supplier
directory** — "Suppliers · Supplier directory",
`project-sidebar/constants.tsx:91-98`) and
`packages/backend/src/modules/compliance-docs/` (an org's own compliance
documents, reachable at `/sales/settings/compliance-docs`). Neither vets anyone.
This is an operational promise about BuildPanda's staff, not a product claim,
and the site presents it inside a product feature list.

---

### 1.9 "Final sign-off and snagging" / "Keys and handover pack" — not a product feature

> "**Completion & handover** — We close out the project, confirm everything is
> done to standard, settle final payments and hand over your finished home."
> Items: "**Final sign-off and snagging**" · "**Closeout of payments and
> documents**" · "**Keys and handover pack**"
> — `packages/web/app/construction/page.tsx:54-57`

> "**Completion & handover** — Sign off on verified work, settle final payments
> and hand over the keys." — `app/page.tsx:41-43`

**What is actually true.** There is no closeout, snagging or handover module.
`closeout` appears zero times in the codebase. `snagging` appears three times —
as a task string in a project template
(`packages/backend/src/modules/projects/templates.ts:49,125`) and as one NRM2
work item ("Snagging & remedial works",
`packages/frontend/src/lib/work-items/building.ts:155`). Handover is a stage
name, not a workflow. The closest real machinery is **Approvals** ("Client
sign-offs") and **Defects liability** as a contractual key date
(`packages/backend/src/db/migrations/20260928_contractual_key_dates.ts`) — and the
dogfood run found that the defects-liability date does not move when the
completion date does.

---

### 1.10 The product tour video is three months stale

> "**Your whole build, in under half a minute** — Watch BuildPanda go from first
> enquiry to a signed proposal and a live construction project."
> — `packages/web/app/page.tsx:117-131`, serving `/demo.mp4`

`packages/web/public/demo.mp4` and `demo-poster.jpg` are both dated **13 June
2026** — three months old. Everything in section 2 below postdates it: RFIs,
tasks, change orders, extensions of time, delays with culpability, look-aheads,
risk register, materials ledger, suppliers, purchase orders, transactions, the
civils library, the inspection service, the admin app and the mobile app. The
video shows a product that no longer resembles the one it advertises.

`buildpanda-walkthrough.mp4` (23 MB, also June) sits in `public/` unreferenced by
any page — dead weight on the deploy.

---

### 1.11 Smaller stale items

| # | Claim | Where | What is true |
|---|---|---|---|
| 1.11a | "**Documents in one place** — Drawings, permits, contracts, and receipts are stored securely" | `for-contractors:71-75`, `for-owners:63-68` | Understated to the point of wrong. The product has **Plans** ("Drawings & revisions") with a **drawing-markup** module, **BIM models**, **Media library**, **Permits & compliance** ("Approvals, expiry & renewals" — a workflow, not a folder), **method statements**, **compliance docs** and **file-shares** with public tokens. Permits are not a document type; they are a compliance surface with renewals. |
| 1.11b | "**From Inquiry to Project Delivery**" | `for-owners:130` | US spelling, inconsistent with the "enquiry" used everywhere else on the site (`page.tsx:25,33,88`). |
| 1.11c | Nav "**Product**" → only `/for-contractors` and `/for-owners` | `lib/site.ts:20-39` | There is **no product page**. The site's entire feature inventory is 6 cards on the homepage and 7 on the persona pages, against 63 backend modules and ~50 project routes. |
| 1.11d | `sitemap.ts` routes list | `app/sitemap.ts:7` | Omits `/talk-to-us` and `/terms-of-service`, both of which exist, are linked from nav and footer, and carry `canonical` metadata. `/talk-to-us` is the site's primary conversion page and is not in the sitemap. |
| 1.11e | "**Build & monitor** — Convert the signed proposal into a project, then follow daily progress, costs and **inspections** in real time." | `app/page.tsx:36-39` | Accurate on conversion (verified below), but "inspections in real time" implies a live feed. Inspections are a request/schedule/attend/report service order, not a stream. |
| 1.11f | "The **construction management platform** that takes you from inception to completion and handover, whether you build from **Lagos** or from **the diaspora**." | `components/footer.tsx:31-35` | The footer is the only place on the site where the whole product is described in one sentence, and it describes a Lagos home-building service. |

### What the site gets right (worth preserving)

- **"One-click handoff — Turn an accepted proposal into a live construction
  project instantly, with budget and milestones ready to go."**
  (`for-contractors:44-48`) — **Verified true.**
  `POST /proposals/:id/convert` and `/proposals/:id/convert/preview`, gated on
  `proposals:convert` (`packages/backend/src/modules/proposals/routes.ts:547-563`,
  `convert-to-project.ts`).
- **"Leads & pipeline"** and **"Proposals & estimates"** — true. `leads`,
  `proposals` modules; `LEAD_STATUSES = ["New","Contacted","Qualified",
  "ProposalOpened","Won","Lost"]`; the site's own consultation form posts to
  `POST /leads/consultation`, which exists
  (`packages/backend/src/modules/leads/routes.ts:75`).
- The **Terms / Privacy / Data Policy** pages are accurate and current — they
  describe RFIs, inspections, BIM, Panda AI and the no-escrow position
  correctly. The marketing pages have drifted away from the legal pages, not the
  other way round.

---

## 2. What the product does that the site never mentions

Grouped by what a buyer would call it, not what we call it.

### 2.1 Contract administration — the single biggest gap

None of this is on the site. For a commercial contractor it is the *entire
reason to buy*.

- **RFIs (requests for information)** — numbered, ball-in-court, overdue
  tracking, internal/shared visibility, external responders via public link.
  `packages/backend/src/modules/rfis/`, sidebar "RFIs · Requests for information".
- **Change orders** — four kinds: `variation` (adds work), `omission` (removes
  it), `eot_only` (time, no money), `provisional_sum`.
  `packages/backend/src/modules/change-requests/types.ts:11`.
- **Extensions of time that actually move the contract completion date.** An EOT
  is now a kind of change order. The decide dialog states: *"The revised
  completion date and every contractual key date move by this many days."* The
  product tracks Contract completion / Revised completion / Days awarded / Days
  claimed undecided. `packages/backend/src/db/migrations/20260927_fold_eot_into_change_requests.ts`.
- **Delays as schedule events with culpability.** Every delay records reason,
  days lost in *working days*, **culpability** (`contractor` / `client` /
  `neutral`) and whether it is EOT-claimable, and cascades to successors, the
  look-ahead, linked key dates and the overview. Hard rule enforced: *"A
  contractor-culpable delay is never claimable."*
  `packages/backend/src/db/migrations/20260915_delay_schedule_events.ts`,
  `modules/change-requests/types.ts:37`.
- **Liquidated damages exposure** against the revised date, with rate/day and
  cap — and honest copy that it is an exposure, not a debt.
- **Contracts & phases** — contract terms, phase costs.
  `packages/backend/src/modules/contracts/`.

### 2.2 The money model: certification vs funding

The site says "milestone payments". The product now says something a QS would
recognise:

- A **certification waterfall**: Original contract + Variations = Adjusted
  contract − Certified gross to date = Still to certify; Amount paid; Unpaid
  certified; **Retention held**; advance recovery from certificate.
  `packages/backend/src/modules/finances/types.ts:87-127,323-324`.
- **Payment claims / payment applications** with a Claim State of
  Claimable / Certified / Forecast.
  `packages/backend/src/modules/payment-claims/`,
  `modules/invoices/pay-application-routes.ts`.
- **Funding is explicitly not certification** — deposits and releases sit in a
  separate funding trail and never enter the contract waterfall.
- **Purchase orders**, **expenses**, **transactions**, **budget**.

### 2.3 Procurement and materials

- **Material orders** carrying stage, site activity, supplier, unit rate,
  estimated cost and expected delivery.
- **Record delivery** — quantity received, delivery date, delivery note number,
  received by, load rejected. **Deliveries book stock into the material log as a
  receipt against the note, and book cost when the order carries a unit rate.**
- **Material log** — "Stock & audit trail".
- **Material approvals** — "Spec sign-off requests" (the consultant approves a
  material specification before it is ordered).
- **Equipment requests** — "Rental workflow". **Suppliers** — directory.
- `packages/backend/src/modules/materials-equipment/`, `materials-ledger/`,
  `purchase-orders/`, `suppliers/`.

### 2.4 Field and quality

- **Daily log** — field reports, back-dating with a "which day are you logging?"
  prompt, future dates blocked, **void a day**, activity hours, a >12h/worker
  warning, and a client-feed opt-in that is **off by default** (*"logging hours
  is a diary entry, not a stakeholder update"*).
- **Risk register** — exposures, owners, responses; mark mitigated / it happened
  / close out; "activity at risk" link.
- **Permits & compliance** — approvals, expiry and renewals.
- **Look-aheads** — rolling short-term planning.
- **Tasks**, **Approvals** (client sign-offs), **Selections** (the client picks
  finishes), **Key dates** (contractual, with revised-from).
- **Plans** with drawings and revisions, **drawing markup**, **BIM models**,
  **Media library**, **method statements**.

### 2.5 The pre-construction suite — a whole half of the product

The app's top-level switcher offers two suites: **"Construction"** and
**"Pre-Construction"** (`packages/frontend/src/components/molecules/suite-switcher.tsx`).
The site mentions leads, proposals and estimates as three feature cards and
never names the suite or the rest of it:

- **AI take-off from drawings** — PDF and DWG take-off engines with a BESMM
  vector store seeded at boot.
  `packages/backend/src/modules/panda-ai/pdf-takeoff/`, `dwg-takeoff/`;
  route `/sales/takeoff/:sessionId`; permission set
  `takeoffs [view, measure, edit, verify, apply]`.
- **Rate library** (`/sales/settings/rate-library`), **compliance documents**,
  **proposal templates**, **proposal packs**, **public proposal links** a client
  can open and accept.
- **Two measurement standards**: NRM2 for building, Road works for civils.

### 2.6 Panda AI — the assistant is never named on the site

`packages/backend/src/modules/panda-ai/agent/` is a project-scoped assistant with
read tools over finance, schedule and site data. Verified in
`docs/dogfood-2026-09-13/verification.md` as answering, correctly and matching
the finance overview exactly: **the contract position** (adjusted contract value,
certified gross, amount paid, retention held, outstanding to certify, LD
exposure, cost vs budget by stage); **what is delaying the project**, with each
delay's reason, cost impact and **culpability from data** ("Client — claimable as
EOT", "Contractor risk"); today's date and the revised completion date; site
diary headcounts and weather.

It is mentioned on the site exactly once — in the Terms of Service
(`packages/web/lib/legal.ts:156`, "AI-assisted tools (Panda AI)"). Not on the
homepage, not on either persona page.

*Honest caveat for whoever writes the copy:* the same verification found Panda AI
still fails "what changed on culvert 1", gives two answers about late material
orders, and does not state the effect of delays on the completion date. Claim the
contract position and the delay list; do not claim a general-purpose project
oracle.

### 2.7 Roles that describe a real contract

The site has two personas. The product has 13 participant roles with a
**contract side** attached (`packages/backend/src/lib/role-presets.ts`,
`ROLE_PRESET_SIDES`):

- **Client side:** Client, **Resident Engineer**, Guest
- **Consultant:** Architect, **Inspector**, **Materials Engineer**
- **Contractor side:** Project Manager, **Quantity Surveyor**, **Site Agent**,
  **Surveyor**, **Foreman**, Materials Requester, Materials Approver

A public-works employer with a resident engineer on site is a first-class
supported shape. The site does not know this persona exists.

*Gap worth noting internally:* only 7 of the 13 have an entry in the invite UI
(`packages/frontend/src/components/molecules/invite-participant-drawer/constants.ts`).
Resident Engineer, Quantity Surveyor, Site Agent, Surveyor, Foreman and Materials
Engineer have backend permissions and a contract side but cannot be picked when
inviting someone. Do not market them until that is closed.

### 2.8 A client portal

The client does not see the contractor's app. `CLIENT_ENTRIES` renders a separate
nav under the heading **"My build"**: Overview, Updates, **Schedules**,
**Selections**, **Finances**, Documents
(`project-sidebar/constants.tsx:204-240`), with `finances:viewCosts` off for the
client preset so the contractor's margin stays hidden. This is the single
strongest answer to "will my client see my costs?" and the site never makes it.

### 2.9 A mobile field app

`packages/mobile` is an Expo app with tabs **Record**, **Schedule**, **Tools**,
**Account**, and tools covering: daily log, RFIs, change requests, look-aheads,
materials, material approvals, documents, **plan review**, schedule, updates and
**Panda AI** — plus **capture**, **sync** (offline-first, with a Drizzle local
DB) and voice notes. For a product whose users stand in mud, this is a headline
feature. The site never mentions that a mobile app exists.

### 2.10 A platform admin app

`packages/admin` (Vite SPA, `/admin/*` API, gated on a global admin role):
Overview, **Growth**, **Engagement**, **AI Operations**, Users, Organizations,
Projects, **Leads**, **Inspections**, **Inspection catalogue**, **Import jobs**,
**Maintenance**, **Feature flags**. This is where BuildPanda runs the inspection
service and processes inbound leads — the operational backbone of the "we are
accountable on the ground" promise. Not customer-facing, but it is the proof
behind claims the site already makes and cannot currently substantiate.

### 2.11 Multi-building projects and import

- **Multi-building**: "Manage Buildings", a building switcher, per-building
  stages (`/project/:id/buildings/:buildingId/stages`), flag
  `projects.multiBuilding`. An estate or a phased scheme is supported.
- **Import**: `/import`, `packages/backend/src/modules/import-sessions/`, plus AI
  programme import (`ai.programmeImport`) and project file import — a contractor
  can bring an existing programme in rather than re-key it. That is a
  switching-cost objection the site never answers.

---

## 3. Vocabulary drift

### 3.1 The two terms the brief asked about — both clean on the site

- **"Queries"** — the site never uses the word. Confirmed retired in the
  product: there is no `queries` module in
  `packages/backend/src/modules/` and no `/queries` page in
  `packages/frontend/src/pages/project/`. Only the migration
  `20260611_queries.ts` remains, as history. **RFIs** replaced it.
- **"Action items"** — the site never uses the phrase. Confirmed retired: no
  module, no page. Migrations `20260610_action_items.ts` and
  `20260623_action_item_recurrence.ts` remain as history; `rfis/types.ts` keeps a
  legacy link target. **Tasks** replaced it.

  *Internal note:* `docs/dogfood-2026-09-13/findings-admin.md` still lists
  `/queries` and `/action-items` as live routes, and the finance docs still
  describe a "homeowner-escrow model". Those documents predate the change. The
  in-app Client role description has already been corrected to "raises **RFIs**"
  (`invite-participant-drawer/constants.ts:16`). Anyone briefing a copywriter
  from the dogfood docs will import retired vocabulary — brief from the code.

### 3.2 Where the site and the product actually disagree

| The site says | The product says | Evidence |
|---|---|---|
| "**owners**", "**project owners**", "For Owners & Clients" | "**Client**" everywhere; the wizard field is "**Client / employer**"; the client's sidebar is headed "**My build**" | `role-presets.ts`, `project-sidebar/constants.tsx:204` |
| "**milestones**" (as the unit of a build) | "**Build stages**", "**Site activity**", "**Key dates**"; "milestone" is now a *finance* term | `project-sidebar/constants.tsx:100-141`, `finances/types.ts:8` |
| "**milestone payments**" | "**payment claims**", "**certificates**", "**certified**", "**retention**" | `modules/payment-claims/`, `finances/types.ts:87-127` |
| "money is **released**" / "funds **move**" | "**recorded**" — money is logged, not transacted | `CLAUDE.md`, `legal.ts:195` |
| "**advisor**" | no such role; the nearest is "**Project Manager**" | `role-presets.ts` |
| "**drone monitoring**" | nothing; the nearest is "**Media library** — Site photos & videos" | zero backend hits |
| "**independent inspections**" (a passive assurance) | "**inspection request**", "**BuildPanda inspector**", "**inspection catalogue**", "**service status**", "**hold point**", "**outcome: pass/fail**" | `inspections/types.ts:21-70`, `admin/src/pages/` |
| "**vetted**" / "**verified**" contractors | no vetting concept; "**Suppliers**" is a project-level directory | `modules/suppliers/` |
| "**Construction OS**" (one product) | two suites: "**Construction**" and "**Pre-Construction**" | `suite-switcher.tsx` |
| "**enquiry**" / "**Inquiry**" (mixed) | "**Leads**" | `modules/leads/`, `/sales/leads` |
| "**Budget & finances**" (one thing) | `finances:view` (client contract position) vs `finances:viewCosts` (contractor internal position) | `lib/permissions.ts` |
| "**change orders**" ✓ | "**Change orders**" ✓ | agrees — keep it |
| "**leads**", "**proposals**", "**estimates**" ✓ | same ✓ | agrees — keep them |

### 3.3 Residual residential language *inside* the product

Not a site problem, but it will bite whoever aligns the two: the app still says
"homeowner" in Settings, "your next dream project" in the create wizard, and
carries residential templates and house-shaped placeholders ("e.g. Second floor
slab poured", "e.g. Roof on (weathertight)"). If the site is repositioned toward
contractors and public-works clients, the app's own copy needs the same pass or
the first demo will undo the pitch.

---

## 4. Audience

### Who each page addresses today

| Page | Addresses | Reality |
|---|---|---|
| `/` (home) | Split personality. Headline says "**the Construction OS for modern builders**"; the problem section says "Stop sending money and waiting in the dark"; a whole dark section is "**For the diaspora** — Thousands of kilometres away, fully in control". | Two buyers on one page, and the diaspora section wins because it is the emotional one. A contractor bounces. |
| `/for-contractors` | Contractors and builders. The only page aimed at the product's actual primary user. | Covers pre-construction well (leads, proposals, estimates, one-click handoff) and delivery badly — four generic cards. Zero mention of RFIs, change orders, EOT, delays, certification, procurement, daily logs, the client portal, mobile or Panda AI. |
| `/for-owners` | "Owners & clients", explicitly framed as distance ("thousands of miles away") and money protection. | The product's client is now a **client / employer** on a contract — increasingly a public-works body (Lagos State Ministry of Works is the dogfood scenario's employer). This page speaks only to a private individual. |
| `/construction` | Diaspora individuals building a home in Nigeria, sold a **managed construction service** where BuildPanda is the builder. | See the conflict below. |
| `/about` | Diaspora individuals. "We are building trust into how **homes** get built in Nigeria." | Homes only. No mention of contractors as customers, or of the software as a product sold separately. |
| `/talk-to-us` | "Tell us about **the home you want to build**." | The only conversion page on the site, and it can only take a homeowner. A contractor evaluating software has no path. |

### Who the product actually serves

1. **The contractor's organisation** — the system-of-record owner. Two suites,
   an org, team members, roles, feature flags, a rate library.
2. **The client / employer** — including a public-works body with a resident
   engineer on site. Gets a separate portal with costs hidden.
3. **Consultants** — architect, resident engineer, inspector, materials engineer,
   quantity surveyor. First-class participants with contract sides.
4. **BuildPanda itself** — as the **independent inspection provider** and as
   platform operator (admin app, lead processing, inspection catalogue).

Nobody on the site addresses buyer 3, and buyer 1 gets one thin page.

### Is the independent-inspection service represented?

**Barely, and misleadingly.** It appears only as a feature bullet inside the
software pitch — "Independent inspections — Third-party quality checks at each
stage" (`for-owners:37-40`). The site never says:

- that a **client can request an inspection** (`REQUESTER_SIDES` includes
  `client`);
- that **BuildPanda assigns the inspector** ("Assign a BuildPanda inspector —
  this is the platform's own act");
- that there is a **catalogue of inspections BuildPanda offers**, managed
  centrally;
- that the inspection carries a **fee** (recorded, not charged);
- that the inspection produces a **pass/fail outcome with findings, photos and a
  re-inspection date**;
- that **the contractor is the subject, never the author**.

That last line is the whole commercial proposition and it is nowhere on the site.
There is no page for the inspection service, no way to request one, and no price.

### The positioning conflict that needs a decision before any rewrite

`/construction` sells BuildPanda as **the main contractor**:

> "**We run the build.** You see everything." · "A true partner **on the
> ground**" · "**Day-to-day site management**" · "**Contractor selection and
> vetting**" · "BuildPanda **runs your build in Nigeria**"
> — `app/construction/page.tsx:83,107,45,39,86`

The product models BuildPanda as the **platform and the independent inspector**:

> "The party being inspected. **The contractor is the subject, never the
> author.**"
> — `packages/backend/src/modules/inspections/types.ts:62`

If BuildPanda both runs the build and inspects it, the inspection is not
independent — and independence is the thing the site sells hardest
("Independent inspections, not assumptions"). Either `/construction` is a
separate, separately-branded delivery business, or the inspection service is not
independent. **The site currently claims both.** This is a business decision, not
a copy fix, and it should be made before the pages are rewritten.

---

## 5. Recommendation

Ordered by what matters most.

### P0 — Fix this week (legal and factual exposure)

1. **Remove every claim that BuildPanda moves money.** Six instances, section
   1.1. Replace "money is released / funds move / payments released" with what is
   true and still strong: *"Every payment is certified against measured work and
   recorded with who approved it and when — an audit trail you can take to a
   dispute."* The site is currently promising what its own ToS disclaims.

2. **Delete the drone section, the two drone videos and all three drone
   claims.** Section 1.2. There is no drone feature. If drone surveys are a
   service BuildPanda's people perform, sell it on `/construction` as a service
   with a price, never as a product capability. This also removes 14 MB from the
   deploy.

3. **Cut "vetted contractors", "verified contractors" and "a single advisor"**
   (sections 1.7, 1.8) or move them to `/construction` and label them plainly as
   what BuildPanda's *people* do, not what the *software* does.

4. **Resolve the independence conflict** (section 4). Decide whether BuildPanda
   builds or inspects. Everything else on the site depends on the answer.

### P1 — Rewrite (the site describes a product from three months ago)

5. **Rewrite `/for-contractors` as the main page.** It is currently the thinnest
   page aimed at the most important buyer. It needs sections on: RFIs and change
   orders; extensions of time that move the completion date; delays with
   culpability; the certification waterfall with retention; procurement with
   deliveries that book stock and cost; the client portal that hides your costs;
   the mobile field app. Use section 2 as the inventory.

6. **Rewrite `/for-owners` as "For clients"** and widen it from the private
   diaspora homeowner to the **client / employer**, including public-works
   bodies with a resident engineer. Lead with the two things the product does
   uniquely well for that buyer: the **independent inspection service** and the
   **certified contract position** (what has been certified, what is still to
   certify, what retention is held).

7. **Re-record the demo video.** Section 1.10. The current one predates every
   feature worth selling.

8. **Fix the milestone/schedule and budget/finances cards** (sections 1.4, 1.5)
   everywhere they appear — three instances each. A programme with predecessors
   and a two-sided finance model are *better* stories than a checklist and a
   spend tracker.

### P2 — Add (pages that do not exist)

9. **A page for the independent inspection service.** The strongest and most
   defensible thing BuildPanda has: a client can request an inspection, BuildPanda
   assigns its own inspector, the inspector attends and issues a pass/fail report
   with findings and photos, and the contractor is the subject, never the author.
   Say who the inspectors are, what the catalogue covers, and what it costs.

10. **A real product page** under the Product nav — the site has none. One page
    per suite: **Pre-Construction** (leads → take-off → estimate → proposal →
    one-click conversion) and **Construction** (the contract administration
    inventory). Use the product's own two-suite split; it is already the app's
    top-level navigation.

11. **A civils / public works page.** The product ships a 70-item Civils & roads
    library, a Civil/Infrastructure project type, and every consultant role a
    highway contract needs. No page addresses this buyer, and the lead form
    cannot even capture them.

12. **Name Panda AI on the marketing site.** Claim precisely what verification
    supports: the contract position and the delay list with culpability. Nothing
    broader.

13. **Say there is a mobile app.** Section 2.9.

14. **Add a contractor conversion path.** `/talk-to-us` only accepts "the home
    you want to build". Add a demo request for contractors, and add
    "Civil / Infrastructure" and "Public works" to `projectTypes` in
    `lib/site.ts:41-47`.

### P3 — Tidy

15. Fix `sitemap.ts` — add `/talk-to-us` and `/terms-of-service` (1.11d).
16. Fix "Inquiry" → "enquiry" on `/for-owners` (1.11b).
17. Delete the unreferenced 23 MB `buildpanda-walkthrough.mp4` from `public/`.
18. Re-point the footer one-liner away from "homes in Lagos or the diaspora"
    (1.11f).
19. Align the terminology table in 3.2 across every page before writing new copy,
    and brief copywriters **from the code, not from the dogfood documents** —
    those docs still contain retired vocabulary (queries, action items,
    homeowner-escrow).

### Do not cut

The diaspora story is real, it converts, and `/construction` is a genuine
business. It should not be deleted — it should be **separated**, so that the
software product and the managed construction service stop being described as
one thing on the same page.

---

## Appendix — files read

**Site (all copy-bearing files):** `app/page.tsx`, `app/for-contractors/page.tsx`,
`app/for-owners/page.tsx`, `app/construction/page.tsx`, `app/about/page.tsx`,
`app/talk-to-us/page.tsx`, `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`,
`app/privacy|data-policy|terms-of-service/page.tsx`, `lib/site.ts`, `lib/legal.ts`,
`components/navbar.tsx`, `footer.tsx`, `hero-visual.tsx`,
`onboarding-timeline.tsx`, `contractor-onboarding-timeline.tsx`,
`consultation-section.tsx`, `consultation-form.tsx`, `ui.tsx`, `icons.tsx`,
`public/`.

**Product:** `frontend/src/App.tsx`; `frontend/src/components/organisms/project-sidebar/constants.tsx`;
`frontend/src/components/organisms/sidebar.tsx`; `frontend/src/layouts/sales-layout.tsx`;
`frontend/src/components/molecules/suite-switcher.tsx`, `project-type-step.tsx`,
`management-step.tsx`, `invite-participant-drawer/constants.ts`;
`frontend/src/lib/work-items/{index,civils,building}.ts`;
`frontend/src/lib/feature-flags.ts`; `frontend/src/pages/project/`;
`backend/src/server.ts`; `backend/src/lib/{permissions,role-presets,working-days}.ts`;
`backend/src/modules/` (63 modules; `inspections`, `change-requests`, `finances`,
`payment-claims`, `leads`, `proposals`, `rfis`, `tasks` read in detail);
`backend/src/db/migrations/` (delay, EOT, contractual key dates, RFI, task,
queries, action-items); `admin/src/App.tsx`, `pages/`, `components/layout.tsx`,
`components/assign-inspector-dialog.tsx`; `mobile/src/app/`;
`docs/dogfood-2026-09-13/` (verification.md + 5 findings files + road-project-plan.md).

**Note on source precedence.** Where `docs/dogfood-2026-09-13/` and the code
disagree, this audit follows the code. The verification run completed at 15:37
today and the civils work-item library, the inspection service rebuild and the
retirement of queries and action items all landed after it. Each of those three
was verified directly against source for this audit.
