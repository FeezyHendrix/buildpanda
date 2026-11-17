**Panda Agent implementation plan**

Build one channel-independent Panda Agent in the main BuildPanda monorepo, with text and voice as equal inputs to the same authorized Field Tools workflows. The operator app is `packages/panda-agent`; the shared engine lives in `packages/backend/src/modules/messaging-agent` and uses the existing backend as the system of record. WhatsApp is the first adapter, using one Panda number shared across companies. Telegram or another messaging service must reuse the same authorization, planner, review, execution and durable recovery paths through an adapter rather than a copied agent.

Implementation has started. The first daily-log milestone and the channel-independent refactor requested on 15 November 2026 are recorded in [IMPLEMENTATION.md](IMPLEMENTATION.md). The source inventory below remains the reviewed baseline rather than a claim that all registered capabilities are implemented.

This plan covers complete field workflow parity, including reads, searches, edits, state transitions, attachments, histories and reports. Reporting is one part of that scope. Delivery proceeds in dependency order; completing an early slice does not establish full parity.

Source baseline: `core`, branch `feat/mobile-boq-materials`, commit `968c7d8dc8cb00bca90e9ff15c8c57c4a4025236`, reviewed 14 November 2026. Existing untracked `.opencode/` and `packages/web/` are outside this review. Reconcile this snapshot with the chosen implementation branch before changing application code.

**1. Backend authority and the definition of complete coverage**

The backend model and schema are the source of truth. Apply the following authorities together:

| Authority | What it determines |
|---|---|
| Ordered backend migrations and resulting PostgreSQL schema | Tables, column types/defaults/nullability, primary/foreign keys, unique/check constraints, immutable record relationships |
| Backend domain models and repository mappings | Entity identity, field meaning, persisted versus computed values, associations and returned DTOs |
| Backend request/response schemas | Supported inputs, exact field bounds, optional versus required fields, explicit nulls, arrays, legal query parameters and output shape |
| Domain services, transition functions and authorization | Legal actions, actor eligibility, state/revision restrictions, side effects and visibility |
| Frontend/mobile forms and shared voice catalog | Consumer workflows to reconcile against the authorities above; evidence of demand, not permission to redefine the backend |

A database column does not automatically become a writable chat field. Derived totals, generated identifiers, actor identity, review timestamps and audit fields stay server-owned. An enum lists possible states; it does not define legal transitions between them.

If a migration constraint, model, API schema or effective service rule disagrees, record a backend contract defect and resolve it explicitly with regression tests. Do not choose the most permissive interpretation, copy a stale consumer contract, or silently introduce a channel-specific business rule.

For every in-scope entity, WP-00 must record each field's type, required/default/null behavior, bounds/units, decimal precision/scale, rounding and round-trip behavior, source of value, relationships, visibility and disposition: writable, readable, derived, server-owned, restricted or outside field scope. Reconcile request numbers with PostgreSQL NUMERIC storage; the model must never choose a rounding or unit-conversion policy. For every action, record actor/scope, feature availability, preconditions, resulting rows, revision rules, side effects and replay behavior. An operation is not covered merely because the agent recognizes its name.

The release denominator is the union of valid field operations backed by those contracts. All corresponding screens and catalog actions must map to that set. Backend functionality absent from a current screen remains eligible; current UI omissions cannot remove a backend-supported field workflow.

**2. Coverage register and scope boundaries**

[coverage.csv](coverage.csv) contains 451 evidence rows: 345 backend route operations, 52 catalog consumer references, 21 semantic variants, 8 visual interactions, 3 native-device boundaries, 16 channel requirements, 4 explicit backend contract gaps and 2 transport dependencies. These are evidence categories, not 451 distinct business features or a claim of full deployed-schema coverage. The API rows include 221 field-required and 38 supporting operations; all other rows have explicit administrative, public-token, preconstruction, commercial, account, consent or transport boundaries. A single route can have several legal action/field variants.

Backend rows include source locations, model/schema references, observed route guard calls, work packages and separate text/voice verification status. Three verification passes expanded the original literal-only census to include loop-generated project/proposal safety routes and object-form authentication registration. The baseline scope review classified all 61 module roots represented by 80 direct server route-entrypoint registrations, including modules outside Field Tools. [backend-scope.csv](backend-scope.csv) now additionally records the messaging-agent module, for 62 roots and 81 entrypoints. The original WhatsApp-only snapshot and its verification remain historical evidence; the generic refactor has its own migration and adapter-contract proof in [VERIFICATION.md](VERIFICATION.md). Its source declaration counts are not counts of runtime routes: loops and wildcard plugins have different expansion rules. Observed guard calls are evidence only: inherited hooks and service checks must also be preserved. This register is planning evidence, not another runtime permission matrix. Detailed findings and remaining limits are in [VERIFICATION.md](VERIFICATION.md).

The existing catalog contains 52 kinds: 21 legacy, 14 field, 7 communication and 10 document actions. They cross-reference backend operations in the register; they are not 52 independently complete agent features. Several names share one backend operation; several backend operations have no catalog name.

Use a stable canonical capability ID per domain operation. HTTP aliases, text, transcribed voice, buttons and app review are entry points to that operation. A route supporting multiple semantic actions must be expanded: change submit/approve/reject/resubmit/execute, for example, cannot be counted as one generic status edit. Composite commands reference their constituent capabilities and dependencies rather than copying business logic.

| Scope class | Treatment |
|---|---|
| Field required | Implement the supported business operation for text and voice, including all valid fields and optional evidence |
| Supporting setup/reference | Reuse scoped project/building/participant discovery and permitted reference management; do not infer new administrative powers |
| Visual interaction | Start and clarify in chat; complete necessary geometry, comparison or structured review in an authenticated visual step; return the result to the originating conversation |
| Native presentation/device | Existing app owns SQLite sync, local file retention, home layout and device controls; the messaging agent exposes its own processing/retry status and a safe handoff |
| Platform administration | Inspector assignment and global category administration remain platform-authorized operations, not tenant messaging-agent tools |
| Account, consent and native transport | Better Auth workspace operations, user-global notification/preferences, owner-only data commitments, browser push, payload-key negotiation and WebSocket transport retain their existing actor and transport contracts; do not emit cross-workspace content or auto-accept terms |
| Public token flow | Existing share/invitation/external RFI reply tokens keep their own contracts; possession of a token does not link a messaging sender to an account |
| Preconstruction or separate commercial scope | Classify explicitly. Takeoff editing, proposal risk drafting, schedule-of-values billing and the rest of finance are not included merely because they share a module |

Visual-assisted completion must be reported as such. A link alone is not completion: preserve the proposal, exact target/revision, validation and result callback. Native offline parity inside a server-side messaging channel cannot be promised. These boundaries are explicit scope decisions, not silently dropped functionality.

**3. Verified backend facts that materially affect the design**

| Finding | Source evidence | Required work |
|---|---|---|
| Daily logs are scoped by project, real building and work date | [building-scope migration](../../packages/backend/src/db/migrations/20260790_programme_building_scope.ts), [daily log schemas](../../packages/backend/src/modules/daily-logs/schemas.ts) | Bind every proposal to that full scope. Review explicit work dates; preserve composite relationships and project-local date interpretation |
| Client and material approvals share storage but have different kinds | [approval model](../../packages/backend/src/modules/approvals/types.ts), [repositories](../../packages/backend/src/modules/approvals/repository.ts) | Preserve the `kind` discriminator, distinct authorization and distinct workflows; do not add duplicate approval tables |
| A finalized material request is immutable; resubmission creates another linked row | [material approval service](../../packages/backend/src/modules/approvals/material-service.ts) | Distinguish editing, Resubmit-to-Pending reopening, and a new linked resubmission |
| Change requests include Executed and named contractual actions | [model](../../packages/backend/src/modules/change-requests/types.ts), [migration](../../packages/backend/src/db/migrations/20260914_contracts_phase_estimates.ts), [actions](../../packages/backend/src/modules/change-requests/change-actions.ts) | Use actual transitions; preserve signed-contract checks, variation records, time awards and programme effects |
| Material ledger has persistent idempotency and stock transactions | [ledger writes](../../packages/backend/src/modules/materials-ledger/entry-writes.ts), [ledger migration](../../packages/backend/src/db/migrations/20260712_materials_ledger.ts) | Supply deterministic action keys and retain existing stock locks/reversals |
| Update comments have a retry uniqueness constraint | [comment-media migration](../../packages/backend/src/db/migrations/20261015_update_comment_media.ts) | Reuse `clientMutationId` and its update/author scope instead of inventing another comment identity |
| Risk state includes lowercase `occurred` | [risk migration](../../packages/backend/src/db/migrations/20260920_risk_occurred_and_link.ts) | Preserve realized-risk history/activity links; do not treat it as closed or delete it through a simplified consumer enum |
| Domain services alone do not include all HTTP protections | [security hooks](../../packages/backend/src/plugins/security.ts), [file attachment guards](../../packages/backend/src/modules/files/attachment-access.ts), domain route files | Shared execution must preserve input validation, sanitization, permissions, ownership and record rules before invoking services |

The migration chain must be applied to an isolated database during WP-00 to verify the effective schema. Static source review establishes these design facts; it does not establish which migrations are applied in production.

Three verification passes identified additional backend prerequisites:

| Prerequisite | Evidence | Required resolution |
|---|---|---|
| Daily whole-day void and daily PDF/email lack a building selector | `daily-logs/service.ts:181`, `report.ts:73`, `routes.ts:195` | Thread a validated building through the backend path or deliberately define authorized aggregation. Period reports currently aggregate days and also need explicit building semantics |
| Voided-day checks differ by operation | `daily-logs/service.ts:125,146,281` | Header upsert rejects voided days; entry and activity paths do not check the marker. Resolve and test the canonical lifecycle rather than asserting existing blanket protection |
| Document visibility is stored but effective enforcement is not established | `documents/types.ts`, `documents/repository.ts:87`, `documents/routes.ts:95,182` | Decide and implement the canonical internal/shared policy across reads, versions, file access, search and AI before channel disclosure |
| Ledger approval checks entry state before acquiring a stock lock | `materials-ledger/entry-writes.ts:18`, `materials-ledger/service.ts:351` | Lock or atomically transition the target entry, then make the outside receipt hook recoverable/idempotent. Test different command IDs targeting the same record |

These are source-level findings, not reproduced production failures. Adding them to this plan does not fix the backend. Their work-package gates must remain open until implementation and database tests resolve them.

**4. Consumer drift to fix before claiming parity**

| Consumer mismatch | Authoritative backend behavior | Planned correction |
|---|---|---|
| Mobile change status omits Executed; legacy edit contract suggests direct status patches | Five named actions with contractual preconditions and revision history | Align consumers with backend transitions; never turn an arbitrary status enum into an executable action |
| Voice material approval requires quantity/unit | Backend requires title/materialName; quantity is optional, minimum zero, default zero; unit defaults to item | Accept the backend's minimum valid request and preserve optional quantities. Do not invent mandatory quantities or silently change domain defaults |
| Voice material approval decision requires a reason beyond the backend contract | Backend accepts optional nullable response | Match backend validation. Any stronger channel confirmation requirement must be explicit and must not be described as a backend rule |
| Voice task actions select one user and cannot clear fields | Backend supports up to 20 user/roster assignees, empty arrays and nullable due dates | Preserve multi-assignee identities and omit/set/clear semantics |
| Voice daily-header update is hours-only and uses today's device date | Backend accepts dated weather, precipitation, wind, workforce, hours and rich summary | Support every valid header field and reviewed work date |
| Voice expense omits receipt/reference/recoverable/editing | Backend exposes these fields and expense edit/delete/read/export paths; amount schema permits zero | Attach actual receipt files, preserve all fields and exact numeric bounds; resolve any desired domain constraint change separately |
| Voice RFI contracts omit assignment, impact, drawing anchors and response references | Backend models structured assignment, booleans, revisions, evidence and proposed/official responses | Preserve structured fields and legal transitions, rather than putting them only in narrative text |
| Voice project update hardcodes empty media and narrows edits | Backend accepts photo/video media, rich content, category/stage edits and publish/status operations | Preserve actual files and lifecycle operations |
| Shared generic validators use different lengths/ranges | Each backend input field has its own bounds | Reuse backend schemas for executable payloads; adapt interaction metadata to them |
| Current snapshots cap history and some options are unbounded | Valid targets can exist outside a prompt snapshot | Add authorized paginated search/detail/disambiguation rather than increasing prompt sizes |

Sources: `packages/voice-actions/src/{field-actions,communication-actions,validation,legacy-fields}.ts`; `packages/backend/src/modules/panda-ai/voice-report/{action-schemas,repository,context-repository}.ts`; `packages/mobile/src/lib/voice/{field-handlers,communication-handlers,types}.ts`; authoritative schemas in each referenced backend domain.

Keep `@buildpanda/voice-actions` compatible with its existing consumers. Extend or extract the necessary definitions; a package rename is not required. The 21 legacy entries currently split field semantics across backend schemas, shared review fields and mobile execution. Reconcile them incrementally with contract tests rather than undertaking an unrelated rewrite.

**5. Complete field domain workstreams**

Each domain below includes list/filter/search, detail, visible relationships, histories and authorized attachment access where supported. The register's endpoint rows and backend field manifest provide the fine-grained checklist; this table describes the business outcomes.

| Domain | Operations to cover | Rules that must survive |
|---|---|---|
| Daily logs | Day/header create and correction; free-form/rich/template entries; activity hours; coverage; entry/day void; PDF/email and period DOCX | Project/building/date key; typed form responses including false/zero; original template snapshot; authorship and void reasons; resolve voided-entry/activity and building/report gaps above |
| Daily-log templates | Read, create, edit/default/activate/archive/delete as supported | Existing organization reference-management authority; used forms retain history |
| RFIs | Raise/edit/reassign; comments; proposed/official response; close/void/reopen; events; distribution; convert to change | Internal/shared visibility; separate response/manage grants; exact drawing revision; explicit external recipients |
| Change requests | Create/edit; submit/reject/resubmit/approve/execute; revisions; comments; budget links and time-claim relationships | Signed-contract prerequisites; claimable delays; awarded versus applied time; no repeat financial/programme effects; protected deletion |
| Material orders and deliveries | Request/edit/approval-tier statuses/cancel; BoQ upload/extract/poll/bulk selection; partial/full/rejected receipt | Explicit order/units/date/receiver; approval-tier permissions; reject reason; receipt already books stock and cost |
| Equipment | Request/edit/status; hire extension and return; deletion as permitted | Hire periods, rates/currency, operator boolean, on/off-hire dates and extension history |
| Material ledger and stock | IN/USED/VOID, pending receipt approval, stock by location, catalog/reorder policy, report/email | Pending versus posted stock; reversal history; negative-stock flags; self-approved attribution where permitted; deterministic idempotency |
| Material approvals | Create/edit/decide/comment/delete Pending/reopen Resubmit/new linked resubmission | Material discriminator; named reviewer; approval versus request permissions; immutable final decisions |
| Supplier directory | Search/detail/create/update/deactivate/delete; permitted organization/project library scope | Shared-library scope and duplicate detection; contacts/lead times/payment terms remain structured |
| Tasks | Board/detail; create/edit/assign/unassign/move/delete; multiple assignees; comments; subtasks; task/entity links; columns/reorder | Created/assigned visibility unless viewAll; building-board constraints; linked entity visibility; correct actor and target column |
| Expenses | Create/edit/delete/refund; receipts; categories; details/analytics/export | Own-record scope without viewAllExpenses; backend amount/default/credit semantics; log money spent elsewhere, never transfer it |
| Activities and delays | Create/edit/delete; dependency type/lag; dates, milestone/progress/assignee; delay raise/amend/resolve; history/references | Calendar-aware cascade; approved-look-ahead constraints; original baselines; contractual versus programme dates; attribution/EOT links |
| Stages and key dates | Read/create/edit/reorder/delete where supported; stage status and linked date behavior | Backend rollups/constraints; building scope; contractual date rules. Commercial SOV billing remains a separately classified boundary |
| Look-aheads | Filter/detail/auto-window; create/edit/assign/unassign; approve/revoke/delete | Dedicated approval/revocation actions; approver history; building/activity compatibility; date and workforce validation |
| Programme/chart | Read chart/baselines; reschedule through existing services; import/poll/apply to existing project; XML and existing report exports | Backend owns dependencies/cascade; source document and import ownership; no invented baseline-reset operation |
| Documents/plans/media | Folder/category browsing; file-backed upload or metadata-only registration; rename/metadata/folder changes/delete; revisions; exact revision view; captured media; shares/revocation | Actual user-selected files for file-backed operations; metadata-only registrations may have no current version. Explain missing bytes rather than inventing them; resolve stored visibility policy; retain controlled share audience |
| Drawing review | Pin, pen, cloud, measurement; comments/media/assignee; resolve/reopen/delete; linked RFI/material approval; view/compare/calibration/undo | Exact document version/page/coordinate space; explicit geometry; existing ownership and undo semantics; no guessed calibration |
| Updates | Draft generation/review/publish; create/edit/status/delete; photo/video; comments and audio conversion | Draft versus published visibility; posting/comment grants; conversion is editable text, not automatic publication |
| Messages | Channel discovery/admin operations; membership; DM; send/reply/edit/delete; thread/search/read state; reactions/pins; forward-to-task | Workspace/project Messages permissions and membership; own-message edit; author/admin delete; archived channels; recipient/thread/attachment scope |
| Client approvals | Submit/detail/edit/decide/reset-to-Pending/delete/comment | Client discriminator and grants; actual named-reviewer decision guard; reopening clears reviewer/timestamps/reminders and differs from immutable final material approvals |
| Inspections/categories | Request/edit/attend/outcome/cancel/delete; categories/reference management | Independent inspection service; assigned inspector records outcome; requester/admin cancellation rules; issued report restrictions; fees are logged |
| Permits | Create/edit/delete/list, expiry/renewal/conditions and document links | Backend date/status inference and urgency; proper linked-document authorization; existing notification effects |
| Organization compliance | Upload/register/edit/delete/read certificates and expiry where exposed to authorized workspace users | Organization `complianceDocs` permission and file access; project permit access does not grant workspace certificate access |
| Project risks | Create/edit/confirm/delete/read; owner/mitigation/review date/activity and realized-risk state | Backend case-sensitive states and service restrictions; project and preconstruction contexts stay separate |
| Method statements and construction phase plan | Project statement list/create/edit/confirm/delete; phase plan read/upsert/confirm | `risks:view/manage`; hazards, ordered steps, controls/PPE, emergency contacts and draft/edited/confirmed provenance. Editing reopens confirmation. Ten proposal-scope equivalents are separately preconstruction; no project AI-draft route exists |
| Weather, insights and reference support | Current/forecast/analysis reads, project aggregates, AI insight read/analyze and phase suggestions; roster discovery and controlled setup | Forecast is not an observed diary fact; analysis is asynchronous; phase suggestions do not commit programme changes. Filter aggregate components by their own permissions; account and roster IDs remain distinct |
| Panda AI, reports and discovery | Grounded project answers, historical record search, home summaries, daily/period reports and authorized source links | Caller-scoped records and histories; citations/reference provenance; recipient-specific report content |

Native sign-in/sign-out, workspace/project/building selection, home customization, local sync retry/discard, document caching, capture permissions and media selection also have explicit dispositions. Linking/unlinking and messaging processing status provide channel equivalents; they do not operate another device's SQLite store.

**6. Shared execution architecture**

```text
WhatsApp / Telegram / another verified channel adapter
             | native sender/message/media IDs, normalized at intake
             v
       shared text or retained voice -> English review text
             |
       explicit linked actor + channel/account + selected scope
             |
       authorized lookup -> answer OR versioned proposal
             |
       clarify/edit/select evidence -> reviewed confirmation
             |
       backend schema + fresh authorization + record-state guard
             |
       canonical domain service + durable action receipt
             |
       shared delivery outbox -> originating adapter -> recipient
```

Keep transport policy in adapters: provider verification and event decoding, account configuration, deep-link/code presentation, media download, outgoing formatting/limits, reply eligibility and send/status outcomes. The shared core consumes normalized inputs and outcomes; it must not read WhatsApp phone-number configuration, assume a numeric sender or impose the WhatsApp service window on another channel. Provider actor IDs and reply destinations must have an explicit contract: either preserve a distinct verified chat/thread target, or reject non-private conversations until their audience/membership model is implemented. A bot channel ID is not automatically an actor user ID. Only the WhatsApp production adapter is initially implemented. Prove the contract with a second in-memory adapter carrying the same workflow; that does not establish a live Telegram integration. Keep capability handlers and backend contract tests shared; adapters add transport-specific fixtures rather than copied business feature catalogs.

Persist identity and message namespaces as `(channel, channel_account_id, sender_id)` and `(channel, channel_account_id, provider_message_id)`. Bind link codes to the intended channel/account, and bind each conversation, proposal, history query and app cache to the selected connection. Identical native IDs from two providers or two bot accounts must never collide. Adapters must also encode any narrower native uniqueness domain, such as a chat-scoped message ID, into the opaque normalized message ID before admission and use the same mapping for replies/status events. Preserve the old WhatsApp tables/data through a forward migration that labels existing rows `whatsapp`. Invalidate old unconsumed codes because their receiving account was not stored, then issue fresh channel/account-bound codes. Reject an unsafe rollback when other-channel data or identifier collisions cannot fit the old schema instead of relabeling or discarding it.

Create a small backend execution module for field operations. It owns a typed registry of capability handlers, their authoritative schemas, permission requirements and execution behavior. Domain modules continue to own construction records and business rules. Keep the catalog's interaction metadata connected to those contracts, without duplicating a second role matrix or permitting arbitrary endpoint/SQL execution by the model.

Extract guards only where execution would otherwise miss HTTP-only behavior. Both HTTP handlers and command handlers consume the same shared authorization/validation boundary. Preserve `AuthorizationRequest`, `accessContextRepository.load`, `resolveAccessContext`, `authorization.ts`, file-reference guards and domain factories. Do not fabricate Fastify sessions or call the backend over HTTP from its own worker merely to reuse a route.

Reuse `classifyTranscript()` for text and transcribed voice after reconciling payload semantics. Incomplete proposals may contain missing values; executable payloads must pass the authoritative backend schema with actual path/query/body semantics. Share validator execution configuration as well as schema text: ordinary routes use Fastify's baseline coercion/defaults/formats, while drawing routes install an encapsulated JSON-body compiler with coercion disabled (`plugins/request-validation.ts`). Compare actual HTTP-injection and direct-executor results for null, zero, false, currency formats and extra properties; do not impose one new validator policy across all domains. Text does not require speech credentials. A user can answer or correct in either format throughout the same proposal.

The existing `lib/speech.ts` helper calls audio translations and returns English text. Preserve the original recording, label the English translation separately from user-confirmed business text, and leave source language unknown unless genuinely supplied. Do not present that output as a verbatim original-language transcript. Verify real WhatsApp formats/codecs in staging and add conversion only if actual samples need it.

Use an explicit read-only business toolset for Q&A. The existing Panda agent immediately executes permitted `create_task` and `create_rfi` tool calls; prompt instructions asking for confirmation are insufficient. User-requested business-record mutations must pass the persisted confirmation boundary, including instructions in quoted or forwarded content. Separately classify existing internal initialization effects: reading a task board can create default columns and reading project channels can ensure the general channel/membership. Retain that idempotent backend behavior under its existing read authorization or use a deliberate pure-read path. Do not silently drop initialization or request business-action confirmation for every internal read acknowledgment. Test concurrent first reads.

Provide useful outcomes for unsupported, denied or unresolved requested actions. The current classifier can silently drop invalid candidates; a partial result must not imply that every instruction was understood or completed. Show understood items, unresolved items and commit results separately. Live language evaluation is needed in addition to contract fixtures.

**7. Identity, security and conversation state**

- An adapter verifies its provider's webhook using that provider's protocol. The WhatsApp adapter validates Meta signatures over original bytes; verification does not establish a BuildPanda user's permissions.
- Link an authenticated BuildPanda user through a short-lived single-use code, then verify the sender's control of the channel/account-scoped identity. Support revocation/relinking and record opt-in/out.
- Keep the channel and receiving provider account (WhatsApp business number or bot account) in transport records; never accept a tenant ID supplied by the model as authority.
- Resolve actual memberships and explicit selected workspace/project/building. Browser auth's first-workspace fallback must not be reused in workers.
- Refresh authoritative actor context before protected processing, confirmation/commit, retry and outbound content delivery. The current access cache has a 60-second TTL: bypass stale entries at critical checks or implement and test an equivalent versioned revocation boundary.
- Preserve backend feature availability independently of RBAC. The current HTTP feature hook has method-sensitive rules and a 15-second cache; shared commands need equivalent discovery, lookup, commit/retry and relevant report/send checks. A disabled feature must not revoke unrelated access or be re-enabled by chat. Preserve exemptions such as permitted building discovery when building mutations are disabled.
- Preserve explicit empty participant grants as deny-all. Unknown or failed access resolution denies protected work.
- Scope histories and lookup caches to user, selected channel/account/connection, workspace, project and relevant building. Clear or re-filter protected history after grant changes; current tool filtering cannot remove secrets already in conversation text.
- Resolve targets through authorized search/detail. Do not leak inaccessible names during disambiguation. Preserve task/expense record scope, internal RFIs, reviewer assignment and message membership.
- Bind a confirmation to actor, selected action IDs, immutable scope, proposal version, payload and expected target state/revision. An edit invalidates its previous confirmation. A bare yes must refer to one unambiguous current review.
- Replies to old proposals retain their original scope after a project switch. Scope changes and competing corrections must not race.
- Require explicit review of destructive actions, decisions, distribution recipients and external shares. Preserve backend rules about whether a reason is required; do not invent a broader approval role or stronger hidden data constraint.
- For incoming files, validate bytes/MIME/limits and authorize staging plus attachment to the target record. Never turn model text into a local path, arbitrary download URL or trusted file ID.
- Sanitize rich content and preserve HTML/plain-text mirrors, booleans, numeric zero, arrays and explicit clear operations. Unsupported field types block review.

Human operators use their own workspace/project capabilities. A shared-number inbox is not a superuser data boundary. Takeover pauses automated replies until deliberately released, and every operator action remains attributed. Define an authorization/state linearization point for execution and disclosure using authoritative versions or suitable transaction/lock boundaries; a fresh check alone cannot guarantee universal instantaneous revocation. Before sending, recheck link, consent, pause/takeover state and the specific protected record dependencies used to build the answer. Drop or regenerate stale content after revocation, unlink/relink or scope change rather than checking only project:view.

**8. Durable execution and preventing duplicate business effects**

Use PostgreSQL for inbox/proposal/action/delivery state and Redis/BullMQ for work scheduling. Production requires Redis; inline timers are not durable execution. The current queue helper removes an existing job with the same job ID, so a stable BullMQ ID does not establish once-only execution.

Proposed channel records, to finalize through migrations and existing model conventions:

| Record | Required persisted behavior |
|---|---|
| Messaging identity link and consent events | User, channel/account/sender identity, link verification, opt-in/out, revocation and relinking history |
| Scoped conversation | Sender, explicit scope, current dialogue/proposal, sequencing/version; no shared global model history |
| Transport inbox/message | Unique provider message identity including channel and receiving account, source timestamps, original text/media references, processing/failure state |
| Proposal and action rows | Stable action IDs, backend capability, versioned payload, resolved targets, dependencies, reviewed confirmation, expected state, result references |
| Delivery outbox | Recipient, source/result references, scope/audience, attempts, provider ID, delivery callbacks and unknown-outcome state |
| Project channel settings | Enable/pause, timezone/report date policy, reminder opt-in/cadence/quiet hours, authorized reviewers/recipients |

Apply unique constraints and foreign keys to those records; use existing IDs/types/conventions. Keep unresolved/unlinked intake quarantined with bounded retention and generic linking responses. Do not expose another company's data or run project AI before scope is authorized. Retain only necessary raw provider payloads, encrypt protected content and apply a documented retention/deletion policy that distinguishes channel data from contractual source records.

Commit steps:

1. Load and lock/claim the exact confirmed action version. Return a stored result if already committed.
2. Resolve current identity, scope, feature availability, permissions, file references and target state. Validate using the backend schema and its validator context. Lock or atomically compare-and-transition the domain target when competing commands could invalidate preconditions; use consistent lock ordering.
3. Execute the domain mutation and persist its result receipt in the same transaction where possible, including all dependent database effects.
4. Persist notification/delivery intents transactionally; process external effects after commit.
5. Return per-action results. Never replay the domain mutation merely because a receipt failed to send.

The current material delivery service inserts delivery, updates the order, books stock, books an expense and links records in separate calls. Add a transaction/idempotent effect boundary spanning those steps before enabling automated retries. An order receipt already books stock/cost; an additional generated stock or expense command must not duplicate those effects. Preserve `origin.ledgerEntryId` and `origin.bookCost` paths.

The current change action service updates lifecycle state before contract creation, time awards and stage shifts. Make this atomic or durably resumable, with deterministic effect identities. A generic action receipt written before or after the service alone cannot close that crash window. Retain all original notification/audit/progress behavior.

For existing material-ledger and update-comment idempotency, supply stable action-derived identities. For other mutations, add transaction-aware receipts or narrowly scoped domain idempotency; content hashes are not user intent IDs. Two intentionally repeated instructions may be two valid actions.

Per-action deduplication does not serialize two different confirmed actions against the same record. Ledger approval currently checks Pending before taking a stock lock; distinct commands may both observe Pending. Require a target-row lock or atomic conditional transition and idempotent downstream receipt effects, then test independent approve/approve and approve/void interleavings. Apply the same analysis to decisions, concurrent deliveries and stale schedule edits. Preserve existing reversing-entry uniqueness instead of assuming a transaction makes every transition safe.

Independent batch actions can succeed separately. Dependent actions wait for actual parent IDs; cancellation does not undo already committed independent records. Persist successes across restarts, and retry only uncommitted work. A sequence such as create pin -> comment -> linked RFI must retain all anchors even after partial failure.

Outbound delivery is at least once with reconciliation, not a distributed exactly-once guarantee. An accepted provider request can time out locally. Persist unknown outcomes, correlate status events and reconcile before resending. Distinguish received, drafted, confirmed, saved, sent and delivered in user-facing receipts.

**9. New app and integration changes**

| Location | Change |
|---|---|
| `packages/panda-agent` | React/Vite operator app using existing authentication/conventions: scoped inbox/review, connections, settings, delivery health, takeover and visual continuation |
| `packages/backend/src/modules/messaging-agent` | Shared identity/scope, normalized input, dialogue, proposal lifecycle, durable delivery/recovery and settings |
| `packages/backend/src/modules/messaging-agent/adapters/whatsapp` | Meta verification/intake, Cloud API/media calls, link presentation and WhatsApp reply policy; future adapters implement the same contract |
| Backend field execution module | Typed backend-contract-backed operation handlers and shared guard seams; one owner per capability |
| Existing domain modules | Reuse services; extract route-only guards/schemas; add minimal transactional/idempotent seams and fix confirmed contract drift |
| `packages/voice-actions` | Compatible interaction metadata/validation aligned to authoritative backend fields; server-file references distinct from device-picked files |
| Panda AI | Read-only messaging-agent entry point, scoped search/detail and awareness of new user-queryable records, without exposing transport internals |
| Frontend/mobile | Account linking entry, contract compatibility, safe visual/deep-link continuation, cross-client cache/realtime consistency |
| Backend migrations | Channel-only state/uniqueness/relationships plus narrowly necessary domain execution keys; no parallel task/log/order/approval tables |
| Backend config, `.env.example`, server and queue registration | Enablement, credentials, pinned API version, exact public webhook exceptions, raw-body verification, workers, limits and required configuration |
| Workspace/deployment | New app scripts/build/typecheck, allowed origins, Docker/Railway setup and staging/production separation |

Current `permits/index.ts` mixes routes, SQL and business logic. Extract only what is needed into the existing service/repository pattern so both entry points share semantics. Do not append to oversized TypeScript files; observe the repository's 400-line limit for new or modified files.

Open only the exact webhook verification/delivery routes to unauthenticated provider requests. Management/link initiation/proposal views remain authenticated. Verify raw signatures before sanitization or JSON mutation; retain global API security protections. Use provider-appropriate ingress rate controls plus per-sender/workspace quotas for AI, media and outbound work.

**10. Implementation order and exit criteria**

| Package | Work and deliverable | Dependencies | Exit criterion |
|---|---|---|---|
| WP-00 | Apply migrations to isolated PostgreSQL; complete field/state/relationship/decimal manifest; classify all registered modules and loop/object registrations; reconcile consumer/backend conflicts and read initialization | Reviewed branch baseline | Every in-scope field/operation has a disposition and canonical contract; internal backend inconsistencies are explicitly resolved |
| WP-01 | Shared authorization and feature availability, route-equivalent validators, sanitization/file guards, typed handlers and domain target/effect atomicity | WP-00 | HTTP and executor agree on schema/actor/availability/state; competing-command and crash tests pass |
| WP-02 | Generic monorepo app/core; adapter contract and first WhatsApp adapter; normalized durable intake/outbox; channel/account-bound linking, consent and explicit scope; permission refresh; data-preserving migration | WP-00 and authorization seam from WP-01 | Two companies use the same number without leakage; repeated intake persists once; identical IDs across two channels/accounts remain isolated; a second adapter reuses the workflow |
| WP-03 | Equal text/voice normalization, actual media staging/association, scoped historical lookup, corrections and useful unsupported/denied outcomes | WP-01, WP-02 | Paired text/transcript fixtures converge; original media preserved; no guessed targets; speech failure leaves text operational |
| WP-04 | Persisted proposals, versioned confirmation, per-action results, dependency sequencing, cancel/retry and recovery | WP-01 to WP-03 | Concurrent confirms and crashes cannot duplicate business effects; stale reviews fail; partial successes persist |
| WP-05 | Daily logs/templates and complete tasks/boards/subtasks/links; reconcile daily building selectors and voided-day lifecycle | WP-04 | All associated backend fields/actions and both input modes pass G-01 to G-08, including two buildings on the same date |
| WP-06 | RFIs/changes, materials/deliveries/ledger/equipment/suppliers, expenses, schedule/key dates/look-ahead/import | WP-04 and delivery/change atomicity work | Full lifecycle and linked stock/cost/time effects verified; existing catalog gaps closed |
| WP-07 | Documents/media/revisions/sharing, visual drawing continuation, updates/comments and all permitted messaging operations | WP-04, scoped media/file guards | Exact revision/media/membership semantics pass; visual tasks return completion to originating proposal |
| WP-08 | Client approvals including reset, inspections/categories, permits, workspace compliance, risks, project method statements and construction phase plan | WP-04 | Correct workflow kind, named actor, issued-report, safety confirmation and lifecycle restrictions verified |
| WP-09 | Recipient-scoped reports/insights/weather, digests/reminders, operator takeover, settings, quotas/cost and delivery recovery | Relevant domain packages | Local-time/building semantics, per-component visibility and in-flight send/takeover fencing verified |
| WP-10 | Whole-register contract/input/security/replay proof, staging field evaluation, rollout and rollback readiness | Every preceding package | Required rows complete for both modes; all boundaries explicit; no unresolved contract drift or P0/P1 execution/security defect |

WP-05 through WP-08 can proceed in parallel once the shared contracts and execution boundary are stable. Establish the first full text-and-voice daily-entry transaction early, but retain the full register as the release target. A single successful daily-log demo is not the completion gate.

Use an initial planning envelope of 12–18 engineer-weeks for full scope, then replace it with work-package estimates after WP-00 measures the final operation/field matrix and domain transaction work. This is a preliminary engineering estimate, not a delivery commitment. Provider onboarding/approval delays, including Meta setup, are external. The earlier 6–8 week reporting-pilot estimate does not represent this expanded scope.

**11. Test and acceptance gates**

Each required operation needs named test cases and proof in the coverage register. Shared parametrized fixtures can cover common boundaries, but must exercise real schemas/guards/services rather than asserting catalog counts or mirroring a handler's implementation.

| Gate | Required evidence |
|---|---|
| G-01 Backend contract | Effective migration schema, model, input/output schema, service operation and legal transitions agree; every field/default/relationship has a disposition |
| G-02 Text | Minimum valid request, complete optional fields, query/detail flow, ambiguity and typed corrections work |
| G-03 Voice | Equivalent transcript fixtures produce the same command/validation/results; real sample evaluation covers names, dates, units and quantities |
| G-04 Complete fields | Required/optional/default/null/clear, false/zero, exact validator configuration, decimal precision/scale/rounding round trips, bounds, rich mirrors, arrays, media and references match the backend |
| G-05 Authorization | Allowed/denied/unknown grants, independent feature availability, tenant crossing, component/record visibility, membership, files and revocation at the defined processing/commit/send boundary |
| G-06 Record state | Named reviewer/inspector, immutable decision, closed/voided record, exact revision, stale target, date/calendar and concurrency rules |
| G-07 Replay and crash | Replays, simultaneous confirms, distinct commands on one target, concurrent first-read initialization, edit-before-confirm, commit crashes, missed dispatch, partial batches and unknown provider outcome |
| G-08 Persisted effects | Correct canonical rows, actor/time/source evidence, original files/revisions, stock/cost/progress/contract effects, audit/notifications and receipts; no duplicates |

Specific combined scenarios:

- Two companies with identically named buildings, people and orders; a user with memberships in both; separate users sharing the Panda number.
- Text request -> voice correction, voice request -> text correction, attached evidence before/after instruction, ambiguous bare yes, quoted old proposal after switching workspace.
- Revoke access before media analysis, after drafting, after confirmation before execution, during retry and before protected outbound delivery. Include stale caches and multiple workers.
- Create task with several roster/user assignees; clear due date/assignees; ensure hidden task/expense details do not leak through links, summaries, search or files.
- Material approval minimum valid fields, exact named reviewer, new linked resubmission, immutable final record; client approval independently tested.
- Accepted/partial/rejected material delivery; receipt approval; negative stock; void; crash between delivery/order/stock/expense steps; no duplicate automatic expense.
- Change approve/execute with variation contract and time award; a signed contract prerequisite; crash between lifecycle update and side effects.
- Drawing markup with exact revision, page, geometry, media and follow-up; superseded revision during review; calibrated measurement and safe visual callback.
- Messages with workspace grant but no project grant and the converse; missing membership; archived channel; reply parent from another channel; explicitly named recipient.
- Independent inspector versus contractor; issued outcome; permit expiry/renewal; realized risk; daily log false/zero/paragraph/image template answers.
- Project-local midnight/DST where relevant, backdated work, quiet day, late entry after report publication and restricted report recipient.
- Invalid signature, MIME mismatch, oversized audio, unsupported input, prompt/HTML injection, forged file IDs and unauthorized share targets.
- Feature disablement with unchanged grants after draft/before retry; enabled building discovery versus disabled building mutation; keep unrelated capabilities usable.
- Different confirmed command IDs approving the same ledger entry; approve versus void; competing decisions/deliveries and stale schedule edits. Inject failure between stock commit and the receipt hook.
- Client approval reset, metadata-only document then attached revision, internal/shared document visibility, project safety editing invalidating confirmation, and fractional quantity round trips.
- Human takeover or permission/link change after answer generation but before send; verify the outgoing content's dependencies, not only broad project access. Exercise actual translated voice samples with corrections.

For model evaluation, use paired realistic text and recorded voice samples per required intent family, including multi-action and noisy field input. Report intent extraction and field accuracy separately from successful action execution. Never call fixture transcript tests proof of speech recognition quality.

Add contract-drift CI: a new scoped backend operation or field/state change requires a coverage disposition and updated fixtures; an executable registry entry requires a real handler and backend contract. Compare the server-registered module manifest, transitive registrations, literal routes, expanded loops, object-form routes and transport wildcards; fail an unsupported registration shape instead of silently dropping it. Keep that census as a change detector, not a generic schema-to-CRUD generator. Changes to shared guards/contracts must run existing mobile/frontend regressions too.

**12. Verification performed and remaining checks**

The following existing suites passed during this review:

| Command | Result | What it establishes |
|---|---|---|
| `pnpm --filter @buildpanda/backend exec tsx --test src/modules/panda-ai/voice-report/coverage.test.ts` | 10 passed | Fixture classification, existing catalog permissions, unresolved targets and review field behavior |
| `pnpm --filter @buildpanda/backend exec tsx --test src/modules/panda-ai/agent/tool-permissions-gate.test.ts` | 8 passed | Tool policy inventory and selected execution-time permission denial |
| `pnpm --filter @buildpanda/mobile test:voice` | 44 passed | Existing extended executors and real SQLite persistence with HTTP/native boundaries supplied by fixtures |
| `pnpm --filter @buildpanda/mobile test:rbac` | 28 passed | Existing mobile policy/route/lifecycle/SQLite boundaries |

Total: 90 distinct existing test cases passed. They establish a reuse baseline, not agent implementation or full backend parity. Non-fatal existing pnpm/Node warnings do not change those results.

Implementation verification also requires affected package typechecks/builds, isolated migration up/down, actual PostgreSQL domain/constraint tests, Redis concurrency/failure tests, new command/executor tests and provider transport fixtures. Existing database-sensitive context/image suites require their dedicated isolated `VOICE_TEST_DATABASE_URL`/`IMAGE_TEST_DATABASE_URL`; a skipped DB case is not a pass. Use no production database for these checks.

At the end of the original planning review, no live Meta, LLM/speech, production database, physical-device, deployed-schema or distributed-worker checks had been performed and all channel execution rows were unimplemented. Later daily-log implementation evidence and the current generic refactor are recorded separately in [VERIFICATION.md](VERIFICATION.md); a historical planning result must not be read as current implementation proof.

**13. Reporting, provider setup and rollout**

Reuse report services and the existing digest review workflow, but correct channel scheduling and audience handling. The current digest runs after 18:00 UTC and builds multi-domain context without a per-recipient permission argument. A full digest cannot be sent unchanged to every project member. Resolve recipient visibility, record scope, reporting date and publication rights before generation/delivery; preserve report versions after late records.

For the first WhatsApp adapter, use the official Cloud API and a Panda-branded shared business number. This adapter-specific policy does not become a requirement for Telegram or another provider. Validate the account's actual use-case eligibility, number ownership, current policies/templates, media formats and limits in staging. Current official documentation describes constrained Groups API eligibility/capacity; direct-message workflows are the launch foundation. Existing group ingestion requires separate proven capability, not an assumption based on Sifu's marketing.

Provider references to recheck at onboarding: [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/), [messaging policy](https://whatsappbusiness.com/policy/), [pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/), [AI provider rules](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers/). Use opted-in messaging, approved templates outside the customer-service window, a clear human escalation path and actual current market/category rates.

Keep staging/production numbers, credentials and storage separate. Pin the provider API version; handle rotation and template-status/number-health changes. Keep credentials server-side. Record per-workspace message, model, audio and media usage without logging unnecessary private content. Limit and pause abusive/noisy tenants so one workspace cannot monopolize the shared number or its reputation.

Stage with at least two companies, multiple projects/buildings and distinct permission combinations. Expand only after every required backend capability passes the register gates in both input modes. Follow the repository's `master` staging and PR-to-`prod` production convention.

Provide integration disable, per-workspace pause, worker drain and recoverable inbox/outbox status. Disabling outbound delivery must not erase received work or cause committed records to repeat on resume. Prefer an application rollback preserving channel records over destructive migration rollback after real source evidence has been collected.

Default protected reports/documents to authenticated links. Downloaded files, already delivered chat content and issued storage URLs cannot be universally revoked by later app permission changes. Recheck before each new disclosure and keep that retention boundary explicit.

**14. Release definition**

Full parity is complete only when the backend field/state/operation manifest is reconciled, every required capability has one canonical implementation path, both text and voice can reach it, every necessary visual step returns a verified result, and its schema/authorization/state/replay/effect tests pass. All supporting and boundary rows must have an explicit disposition. No missing handler, dropped instruction, unclassified backend field or mock-only integration may count as completed functionality.
