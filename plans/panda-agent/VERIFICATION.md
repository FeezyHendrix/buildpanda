**Panda Agent — current verification evidence, 16 November 2026**

The backend models, migrations, request schemas, effective grants and canonical domain services are authoritative. The current implementation exposes **53 action kinds (52 shared mobile kinds plus standalone delay)** and **60 read tools (45 existing plus 15 full-record readers)** through the channel-independent engine and app. These counts are checked against the actual registries, not inferred from the planning register. See [IMPLEMENTATION.md](IMPLEMENTATION.md).

**Current release gate status**

| Check | Recorded result | Evidence boundary |
|---|---|---|
| Final expanded backend gate | **238 passed, 0 failed, 0 skipped; 47 entrypoints** | Fresh disposable PostgreSQL with all **224 migrations** and isolated Redis. The checked-in gate requires every named suite. Final log: `/tmp/buildpanda-agent-gate-frozen.log`. |
| Canonical read verification | **8 passed, 0 failed, 0 skipped** | `field-actions/read-tools-db.test.ts`: all 15 new reads run without DML, plus current-grant/record-scope/feature/membership/revision tests. Discovery independently sweeps all 60 reads with zero DML. |
| Work-action regression after task-service extraction | **3 passed, 0 failed, 0 skipped** | `field-actions/work-coordination-db.test.ts` executes all 19 kinds and tests denied/state/scope behavior and rollback. |
| Attachment and recovery checks | **10 passed, 0 failed, 0 skipped** | `messaging-agent/attachments-db.test.ts` and `recovery-service.test.ts`: authorize before fetch, retain/reuse originals, multipart ingress and stale web recovery. |
| Collaboration/schema/editor verification | **15 passed, 0 failed, 0 skipped** | Collaboration schema/DB and UI schema checks, including compound drawing follow-ups and typed assignees. Counts overlap the full gate and are not added to it. |
| Mobile shared voice regression | **44 passed, 0 failed, 0 skipped** | Official `pnpm --filter @buildpanda/mobile test:voice` loader exercises mobile execution, review and RBAC contracts. |
| Backend, frontend and Panda Agent typechecks / production builds | **Passed** | Final local release checks, including backend bundle/declarations and shared editor packages. Backend build log: `/tmp/buildpanda-agent-build-frozen.log`. |
| Final production-browser fixture | **Passed; all 53 schemas; no browser/console errors** | Typed/rich nested corrections, source-by-kind assignees, precision/read-only confirmation, multipart staging/ingress, actual cookie-bearing PDF byte equality/preview/download, unsafe MIME blocking, handoff authentication/project allowlist/revocation and account/channel isolation. Fixture API `/api`. |
| Configured AI probe | **9/9 passed** | Eight synthetic text cases and one synthetic recording through actual Whisper then the configured planner. Includes material clarification, receipt/order intent, task/RFI/diary and explicit expense currency. No construction-record writes or provider sends. Log: `/tmp/buildpanda-agent-live-probe-final.log`. |
| Expanded-scope Railway deployment and live Staging/provider acceptance | **Pending** | Existing GitHub/Railway CI path is next. Hosted real-user login, incoming Telegram/WhatsApp media/voice/buttons and production-storage delivery remain separate from local fixtures and synthetic AI probes. [RAILWAY.md](RAILWAY.md). |

Source/test paths below are relative to `packages/backend/src/modules/` unless a package path is given. Focused results overlap the aggregate gate; they must not be summed into a new total.

**Pass 1 — Independent canonical model, schema and lifecycle review**

The domain execution review compared the shared 52-kind catalog and the manual mobile delay action with actual request validators, services, state transitions, permissions and storage constraints. Three executor families reuse the canonical services and extracted HTTP schemas: 16 site-record kinds, 19 work-coordination kinds, 17 collaboration kinds, plus `raise_activity_delay`.

| Verified behavior / corrected finding | Source and executable evidence |
|---|---|
| Every shared kind is registered, validated and retained through the common text/translated-voice proposal path; unknown fields are rejected | `field-actions/tools.ts`; `messaging-agent/field-tools.test.ts`; `field-actions/{site-records,work-coordination,collaboration}.test.ts` |
| Incomplete deliveries are material intents; collect exact material/quantity/unit instead of inventing contents or reducing them to diary notes | `messaging-agent/{draft,material-review,draft-errors}.ts`; `{material-review,material-conversation}.test.ts` |
| Quantity matches the ledger's finite positive `numeric(14,2)` contract without silent rounding; current ordinary receipt behavior is Approved | `materials-ledger/quantity.ts`; `field-actions/material-log-db.test.ts`; `messaging-agent/material-review.test.ts` |
| Receipt units and explicit expense currency are checked against current canonical records; mismatches do not silently convert quantity or amount | `field-actions/site-records-db.test.ts`; `messaging-agent/field-tools.test.ts` |
| Templates, full headers, entry voids, approval reviewer/decision/reopening/new-resubmission rules, delivery stock/cost effects and real actor attribution | `field-actions/site-records-db.test.ts`; canonical `daily-logs`, `approvals`, `materials-ledger`, `materials-equipment`, `transactions` modules |
| Own/assigned task rules, exact board/building/column/assignees, shared-only external RFI access and proposed versus official responses | `field-actions/work-coordination-db.test.ts`; canonical `tasks/{access,visibility-service}.ts`, `rfis/{access,service}.ts` |
| Revision/page/geometry are explicit; drawing follow-up children use the actual new pin ID and canonical child guards; nested failure rolls everything back | `field-actions/collaboration-{drawings,follow-up}.ts`; `collaboration-db.test.ts` |

**Pass 2 — Independent transactional, durable transport and replay review**

The persistence/transport review inspected intake, original media, proposal replacement, execution, action receipts, retry and the outbox independently of the domain-family implementation. Reproduced findings were corrected and given regression cases.

| Verified behavior / corrected finding | Source and executable evidence |
|---|---|
| Clarification retains conversation context and invalidates the earlier pending Confirm; mixed material/task/RFI confirmation commits once | `messaging-agent/{review-service,draft,repository-proposals}.ts`; `material-conversation.test.ts`, `review-access-db.test.ts` |
| Reordered corrections associate retained details with stable actions rather than array position | `messaging-agent/field-tools.test.ts` |
| Canonical writes, receipt and completion share the caller transaction; external notifications/jobs wait for every parent commit and skip rollback | `field-actions/{site-records,work-coordination,collaboration}-db.test.ts`; `material-log-db.test.ts`; `materials-ledger/notification-queue.ts` |
| Provider attachments and web multipart capture use canonical staging/access before download/buffering, preserve captions and original bytes, and reuse source files on retry | `messaging-agent/{attachment-ingress,attachment-media,upload-routes,source-files}.ts`; `attachment-media.test.ts`, `attachments-db.test.ts` |
| Stale web received/processing rows fail with a recovery message and retained original; stale provider processing remains retryable under original scope | `messaging-agent/repository-inbox.ts`; `recovery-service.test.ts` |
| Long replies preserve all content and ordered native Confirm/Cancel buttons; each part retains proposal/version/status fencing; failed/uncertain earlier parts block later buttons | `messaging-agent/{message-parts,worker-outbox}.ts`; `message-parts.test.ts`, `reply-buttons.test.ts`, `portability.test.ts` |
| Real server/auth/verified adapter ingress, namespaced sender/account/history and original voice provenance are covered with external services injected | `messaging-agent/{runtime,telegram-runtime,portability}.test.ts`; Telegram/WhatsApp adapter suites |

**Pass 3 — Independent discovery, read disclosure and UI verification**

The read/security review checked the composition against the actual Panda AI registry and mobile manual reads; the UI review separately checked typed schemas, rich content, files, drawing follow-ups and authenticated artifacts. A successful owner flow was not treated as denied-path evidence.

| Verified behavior / corrected finding | Source and executable evidence |
|---|---|
| Exactly 60 allowlisted reads exclude write/navigation tools; all new domain readers use fresh grants, canonical features and record scoping | `messaging-agent/tool-discovery-policy.ts`; `tool-discovery.test.ts`; `field-actions/read-tools-policy.ts` |
| First explicit General-channel sends work on new projects; discovery/review remain read-only, current grants are required, and project locking/rollback prevent duplicate or partial channels | `messaging/general-{repository,wiring}.ts`; `field-actions/collaboration-db.test.ts`; `messaging-agent/review-access.ts` |
| Reads do not create a default task board, channel or main contract; standalone reads use PostgreSQL read-only/repeatable-read execution | `field-actions/read-tools-db.test.ts`; `messaging-agent/tool-discovery.test.ts`; `tasks/service.ts:getExistingBoard`, `contracts/service.ts:recordedMainContractId`, `stages/wiring.ts:buildStagesReadService` |
| Own/assigned tasks, authored expenses, shared RFIs, workspace/project Messages grants and channel membership remain independent boundaries | `field-actions/read-tools-db.test.ts`; `messaging-agent/tool-discovery.test.ts` |
| Task linked-record labels now check linked-domain permission, target project and external RFI visibility in both REST and the agent; adding an entity link uses the same target guard | `tasks/{entity-access,entity-access-repository,routes}.ts`; `field-actions/read-tools-db.test.ts` |
| Queued answers/history and completed-confirm replay redact access after grant or task-assignment changes, even when the permission map itself is unchanged | `messaging-agent/{read-access,read-scope-repository,history,review-access}.ts`; `review-access-db.test.ts`, `field-tools.test.ts` |
| Every canonical schema has typed review controls; unknown controls block confirmation; rich HTML/plain mirrors, nested arrays, templates and picked files are preserved | `packages/panda-agent/src/components/`; shared `packages/rich-text-editor`; `packages/panda-agent/scripts/smoke.mjs` (final production-browser fixture passed) |
| Document receipts expose only generated, authenticated exact-revision artifact links; actual app byte fetch/preview/download rechecks access and rejects unsafe preview types | `messaging-agent/artifacts.ts`, `artifacts.test.ts`; `packages/panda-agent/src/components/document-artifact.tsx`; final browser cases passed |

**Coverage accounting and remaining boundaries**

[coverage.csv](coverage.csv) still contains **451 evidence rows**: 345 backend API operations, 52 catalog references, 21 semantic variants, 8 visual interactions, 3 device boundaries, 16 channel requirements, 4 contract gaps and 2 transport dependencies. These categories are not 451 independent implemented features. Only the 52 catalog rows and specifically evidenced semantic rows receive the current `evidenceLocalVerified` status; backend-only endpoints are not mass-promoted. A catalog row establishes local canonical behavior and shared input plumbing, not live-language accuracy for every utterance.

Provider photo/video/document or app file selection is a protocol equivalent for supplying real bytes; it is not a physical-camera test. Exact drawing geometry/revisions are supported, while calibration, compare/layers/zoom/pan and other viewer gestures remain authenticated viewer/device workflows. Native offline snapshots/files, device sync/outbox controls and home customization remain mobile boundaries, distinct from server-side durable retry.

Live Telegram text/voice/media/button delivery, live WhatsApp credentials/delivery, hosted existing-user login and real storage download must be checked against the deployed expanded implementation. The configured synthetic AI/Whisper probe verifies nine bounded cases; it does not establish noisy, multilingual or real-field voice quality across all supported actions. Provider acceptance is external to the SQL transaction; an accepted send cannot be universally recalled. Unknown send acceptance remains quarantined. Storage/DB interruption can leave a retained original or orphaned binary; SQL rollback does not roll storage back. No document readiness receipt claims the provider has delivered or the user has downloaded bytes.

**Historical evidence — not the current release total**

The original three source reviews at backend commit `968c7d8dc8cb00bca90e9ff15c8c57c4a4025236` audited the plan, expanded route inventory to 345 API entries and classified the 451-row register. They found building/void/precision/bootstrap/feature/disclosure gaps; they did not execute future integration or establish deployed-schema coverage. Their conclusions remain in [PLAN.md](PLAN.md), [coverage.csv](coverage.csv) and [backend-scope.csv](backend-scope.csv).

| Earlier milestone | Recorded result | Historical boundary |
|---|---|---|
| 14 November WhatsApp daily-log milestone | 70 backend tests / 16 entrypoints; 8 existing template tests; local builds and fixture Chromium smoke passed | Daily notes/header slice, injected providers/models |
| 15 November generic channel refactor | 82 backend tests / 19 entrypoints, zero failures/skips; local typechecks/builds/smoke passed | WhatsApp plus an in-memory second adapter, not live Telegram |
| 16 November Telegram release candidate | 116 backend tests / 26 entrypoints, zero failures/skips; local builds and transport/telemetry/helper checks passed | Actual adapters with external services injected; live checks separate |
| 16 November formatted reviews/native buttons (`e5689a4ce41ec89983f4b1f892ff1f8d50cbe95f`) | 143 backend tests / 28 entrypoints, zero failures/skips; backend typecheck/build and GitHub Staging deployment recorded | Earlier scope; did not establish live button clicks or the current expanded Field Tools release |

Historical counts overlap later runs and are not added to the current gate. Deployment and live verification remain recorded by the release owner in [RAILWAY.md](RAILWAY.md).
