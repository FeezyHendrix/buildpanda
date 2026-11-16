**Panda Agent verification evidence**

Three independent source reviews checked the saved implementation plan and coverage register against backend commit `968c7d8dc8cb00bca90e9ff15c8c57c4a4025236`. The backend models, migrations, schemas and effective services remained authoritative. Findings were incorporated into [PLAN.md](PLAN.md), [coverage.csv](coverage.csv) and the new [backend-scope.csv](backend-scope.csv).

These original passes verified planning evidence and found actual omissions. At that point they had not executed the future integration or proved the deployed database schema, and text/voice implementation statuses were `not_implemented`. Later milestone and generic-refactor evidence is recorded separately below.

**Pass 1 — Models, schema and lifecycle semantics**

Compared domain models, selected migration constraints, input schemas and actual service behavior. Checked existing plan claims against multi-building keys, lifecycle branches, optional file registration and decimal storage.

| Finding | Backend evidence | Correction incorporated |
|---|---|---|
| Day void and daily PDF/email lack a selected building | `daily-logs/service.ts:181`, `daily-logs/report.ts:73`, `daily-logs/routes.ts:195` | Explicit backend contract gap; WP-05/WP-09 must thread building selection or define aggregation, including period reports |
| Voided-log protection is not uniform | `daily-logs/service.ts:125,146,281` | Removed blanket claim of current enforcement; header versus entry/activity semantics must be reconciled and tested |
| Client approval reset differs from material reopening | `approvals/service.ts:140`, `approvals/material-service.ts:221,290` | Added reset-to-Pending variant with reviewer/timestamp/reminder clearing; material final decisions retain separate rules |
| Metadata-only documents are valid | `documents/service.ts:145`, `documents/routes.ts:40` | Added register-without-bytes mode and explicit unavailable version/download behavior |
| Stored document visibility does not establish an effective access policy | `documents/types.ts`, `documents/repository.ts:87`, `documents/routes.ts:95,182` | Added policy/implementation gap across list, version/file, search and AI access |
| Ledger entry state is checked before the stock lock | `materials-ledger/entry-writes.ts:18`, `materials-ledger/service.ts:351` | Added target-state concurrency and downstream receipt-hook recovery prerequisites |
| Request decimals and persisted quantity scale can differ | `db/migrations/20260712_materials_ledger.ts:38,87`, `materials-equipment/schemas.ts:58` | Added precision/scale/rounding/unit round-trip requirements to WP-00 and G-04 |

Paths above are relative to `packages/backend/src/`. Material resubmission also has its own copy semantics: it creates a linked new row, clears source drawing anchors, and some inherited values use null-coalescing. WP-00 must not assume create/edit/resubmit have identical clearing behavior. Existing ledger reversal uniqueness must be preserved.

Result: concrete model/service gaps are now explicit prerequisites. Their runtime behavior remains unverified; documenting a gap does not resolve it in application code.

**Pass 2 — Operation discovery, registration and scope**

Compared the selected route ledger with the whole server registration surface, transitive module routes, nonliteral route definitions and consumer interactions. Classified every one of the 61 module roots represented by the server's 80 direct route-entrypoint registrations.

| Finding | Evidence | Correction incorporated |
|---|---|---|
| Literal-only enumeration missed loop-expanded safety routes | `modules/method-statements/routes.ts:91` | Added 8 project method-statement/phase-plan operations and classified 10 proposal equivalents as preconstruction |
| Root Panda AI routes were omitted | `modules/panda-ai/routes.ts:74,83,94,105` | Added insight read, asynchronous analysis, phase suggestions and extract/poll/apply evidence; import requester/scope remains an explicit guard requirement |
| Weather, aggregate insights and roster support were absent | `modules/weather/routes.ts:14`, `modules/insights/index.ts:21`, `modules/team-members/routes.ts:65` | Added source operations and explicit setup boundaries; forecasts are not diary facts; aggregate components need their own visibility |
| Account/control/consent surfaces had no disposition | `modules/auth/routes.ts:29`, `modules/permissions/routes.ts:10`, `modules/org-profile/routes.ts:39`, feature/maintenance/notifications/data-commitment modules | Added object-form GET/POST auth wildcard and supporting/boundary operations; owner consent, user-global content and native push are not tenant chat shortcuts |
| Feature availability existed only in HTTP hooks | `plugins/feature-flags.ts:36` | Added shared command availability requirement independent of RBAC; preserve method-sensitive exemptions |
| Chart JSON export lacked its own interaction row | `packages/frontend/src/pages/project/schedule.tsx:87` | Added chart-report disposition, keeping the genuine XML/MSPDI programme export separate |
| Selected modules were an incomplete discovery denominator | `server.ts:172` through direct registrations | Added a complete module scope manifest; excluded commercial/preconstruction/platform APIs are explicit boundaries rather than implicit omissions |

Backend evidence paths above are relative to `packages/backend/src/` unless a full package path is shown. The scope manifest separates actual registration locations in `server.ts` from route-module paths; server line numbers are not misrepresented as route-file line numbers.

The route check also classified payload-key and WebSocket plugin routes as transport dependencies. Better Auth owns operations behind its wildcard; the wildcard is not an enumerated list of plugin internals or permission to invoke arbitrary account operations.

Result: 65 additional backend operation entries were incorporated. The register now has 345 backend operation entries, with explicit scope rather than automatically exposing the entire product to chat.

**Pass 3 — Execution, authorization and recovery**

Reviewed HTTP hooks and validator setup, access-context/cache behavior, AI execution, queue semantics, ledger state ordering, first-read initialization, speech provenance and delivery fencing. Inspected existing test scripts and fixture boundaries; no test suite was rerun during these passes.

| Finding | Evidence | Correction incorporated |
|---|---|---|
| Permission checks alone do not preserve feature availability | `plugins/feature-flags.ts:17,36`, `modules/feature-flags/service.ts` | Check lookup/tool discovery, commit/retry and relevant report/send availability; feature-disabled must not revoke unrelated access |
| Per-action idempotency does not serialize distinct commands on one record | `modules/materials-ledger/entry-writes.ts:18` | Require domain locks/atomic transitions, consistent lock order, distinct-command approve/approve and approve/void tests, and effect recovery |
| Some reads intentionally initialize backend records | `modules/tasks/service.ts:250`, `modules/messaging/routes.ts:81` | Distinguish pure reads, approved idempotent bootstrap and user-requested business mutations; test concurrent first reads |
| Speech helper returns English translation | `lib/speech.ts:16` | Separate original recording, translated text and user-confirmed text; do not invent original-language transcript or language metadata |
| Prechecks leave in-flight state/disclosure races undefined | `modules/access-context/repository.ts`, `lib/queue/index.ts` | Define authorization/state linearization; recheck data dependencies and consent/link/pause/takeover before sending; drop/regenerate stale content |
| Schema text alone does not reproduce validator behavior | `server.ts:129`, `plugins/request-validation.ts:59` | Preserve ordinary Fastify versus encapsulated drawing-body compiler semantics and formats; test HTTP/executor parity |

Paths above are relative to `packages/backend/src/`. The ledger concurrency concern is a source-derived interleaving, not a reproduced PostgreSQL failure. The plan now requires that reproduction and a verified resolution before enabling the affected action.

Result: shared execution prerequisites and G-04 through G-08 now address these gaps explicitly. Provider-accepted delivery remains outside the local database transaction and cannot be universally recalled.

**Final artifact consistency checks**

The final register contains 451 evidence rows:

- 345 unique backend method/path entries, including the manually inspected loop expansion and object-form auth methods.
- 52 unique existing catalog consumer references, all mapped to existing backend operation IDs.
- 21 backend semantic variants, 8 visual interactions and 3 native-device boundaries.
- 16 channel requirements, 4 backend contract-gap rows and 2 transport dependencies.

Validated unique IDs and API keys, all canonical API references, evidence file existence and valid line locations, complete 61-module/80-entrypoint scope coverage, local document links, referenced work-package/gate IDs and explicit unimplemented text/voice statuses. The register is not a second permission policy or a claim of 451 independent features.

The original 90 passing tests remain historical baseline results from the preceding review. These passes inspected their scope rather than counting another run. Source changes were limited to planning artifacts, so application suites were not repeated merely to produce another pass count.

**Remaining proof before full parity can be claimed**

The first milestone now has an isolated migrated database; WP-00 still needs the complete effective field/constraint manifest for the remaining domains. The route inventory cannot certify every column, default, relationship or deployed migration state. Backend lifecycle, visibility, precision and atomicity findings remain open implementation prerequisites. All 8 acceptance gates must be satisfied by real implementation evidence for each required capability.

At the end of the planning passes, live Meta behavior, actual voice/model quality, physical-device workflows, database concurrency, Redis recovery, runtime route registration and production configuration were unverified. Implementation evidence below supersedes that historical status only for the first daily-log milestone.

**Historical first implementation verification — 14 November 2026**

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the working flow, configuration and remaining scope. The original inventory was 61 registered module roots/80 entrypoints. The first channel implementation added one root/entrypoint, now represented by the messaging-agent module: `backend-scope.csv` now includes 62 roots/81 entrypoints. The canonical Field Tools evidence denominator remains 451 rows; new channel transport is represented by its channel rows rather than counted as additional completed field operations.

| Check | Final result | Scope |
|---|---|---|
| `pnpm --filter @buildpanda/backend test:whatsapp` | 70 passed, 0 failed, 0 skipped | 16 checked-in regression entrypoints; real isolated PostgreSQL and Redis |
| Existing daily-log template suite | 8 passed | Canonical field/response normalization and template snapshots |
| Backend typecheck and production build | Passed | All backend TypeScript, bundled entrypoints and declarations |
| Panda WhatsApp typecheck and production build | Passed | New workspace package and shared UI imports |
| Chromium browser interaction smoke | Passed | Fixture HTTP transport; linking, correction, confirmation, stale versions, cancellation, scope/account isolation, denied/read-only behavior, unsupported field blocking and retry |
| Full backend runtime integration | Passed within the 70-test gate | Real Better Auth password/session flow, app-origin CORS, 10 authenticated management routes, provider challenge/signatures, linking, worker drafting, HTTP commit/replay/unlink and clean shutdown |
| Dependency install | Passed | Frozen lockfile, filtered offline install for the new package |
| Source/artifact checks | Passed | Explicit test ignore exceptions, all 16 suites present/in gate, whitespace check, every changed TypeScript file within 400 lines, 451 unique coverage IDs |

Three implementation verification passes addressed these concrete findings:

1. **Canonical models and execution:** checked full daily-log schemas, real buildings, nullable/zero/rich-text semantics, current actor grants and file references. Fixed backend building selectors and void lifecycle checks. Reproduced cross-channel duplicate-day creation and a note slipping in after a competing void, then fixed them in the shared repository. PostgreSQL tests also observe actual row-lock waits and preserve the first concurrent void decision.
2. **Transport and persistence:** checked raw signatures, provider event deduplication, immutable message/proposal scopes, opaque sender IDs, single-use link codes, source audio retention, versioned corrections, atomic action receipts, retained-source retry and unknown-send quarantine. Link commands now retain only a hash. Error replies cannot suppress a later successful review, and pending errors are cancelled after successful retry.
3. **Independent security and runtime review:** reproduced an inherited encrypted-body parser bypass of webhook signatures, then verified the corrected route rejects it with HTTP 415 before any database transaction. Verified raw provider text bypasses browser sanitation/file-reference admission hooks while execution still authorizes references. Checked create-only versus history-view access, building revocation on edit/confirm, account-scoped caches, untruncated reviews and blocked hidden template/file/rich-content confirmations. Fixed and regression-tested duplicate repeating workers, timer cleanup and a Redis subscription shutdown rejection.

The runtime integration uses the complete application and a real signed-in session, but injects model/provider operations to prevent external calls. Voice tests retain/reuse actual fixture bytes and run the real processing/persistence path with injected storage/speech/provider dependencies. They do not establish real speech recognition quality, actual S3 operation or a live Meta account connection.

Live Meta delivery/account setup, live speech/model quality, deployment behavior, outbound templates/reconciliation, human takeover, quotas/reminders, remaining backend contract gaps and broader Field Tools parity remain unverified or unimplemented. No production database was migrated, no external messages were sent, and no deployment was performed. The temporary PostgreSQL/Redis infrastructure was isolated from the user's existing services.


**Channel-independent refactor — 15 November 2026**

The app and shared engine are now named Panda Agent and `messaging-agent`; WhatsApp is an adapter. The 70-test result above belongs to the previous WhatsApp-only snapshot and is not a current generic-version test count. The full Field Tools target remains the same 451 evidence rows. No row becomes complete merely because transport code has been renamed.

Current verification must prove all of these boundaries against actual code and migrated PostgreSQL:

- Identity, inbox deduplication and delivery correlation include channel and receiving account; native IDs may collide across providers or bot accounts without crossing records.
- Link codes are single-use and bound to the intended channel/account before a connection can be created.
- Selected-connection ownership controls histories, proposals, corrections, confirmation, retries and UI cache keys. A user's access to a project does not merge their unrelated channel histories.
- The shared planner/executor/recovery path runs through a second adapter whose transport policy differs from WhatsApp and whose IDs are opaque; this does not claim a live Telegram integration. Verify the actor/reply-target contract and reject unsupported group/thread ingress rather than assuming every chat ID equals a user ID.
- WhatsApp signatures, deep links, business-number IDs, media calls, formatting and 24-hour reply eligibility remain inside its adapter.
- Existing WhatsApp identities/messages/proposals/actions/receipts survive migration and retain their sources and state. Old unconsumed codes are invalidated because their receiving account was never stored; fresh codes are channel/account-bound. Rollback rejects incompatible other-channel rows rather than losing or relabeling them.
- Existing RBAC, immutable project/building scope, versioned review, source retention, canonical daily-log concurrency and unknown-send safeguards remain effective.

The current backend gate is `pnpm --filter @buildpanda/backend test:messaging-agent`, using isolated `MESSAGING_AGENT_TEST_DATABASE_URL` and `MESSAGING_AGENT_TEST_REDIS_URL`.

| Portability baseline check | Final result | Scope |
|---|---|---|
| `pnpm --filter @buildpanda/backend test:messaging-agent` | **82 passed, 0 failed, 0 skipped** | 19 checked-in regression entrypoints against isolated PostgreSQL and Redis |
| Backend typecheck and production build | Passed | Shared engine, adapters, existing canonical services and declarations |
| Panda Agent typecheck and production build | Passed | Renamed workspace package, generic channel/account/connection UI and shared atoms |
| Chromium interaction smoke | Passed | Fixture messenger with another reply policy, two accounts/connections, connection-ID mismatch denial, code-only linking, connection-specific unlink, review/correction/retry/RBAC and cache isolation |
| Frozen offline filtered install | Passed | New `@buildpanda/panda-agent` workspace importer and existing dependencies |
| Full backend runtime integration | Passed within the 82-test gate | Real Better Auth session, actual WhatsApp HMAC boundary, generic connection API, canonical confirmation/replay/unlink and clean shutdown |

The aggregate count includes component tests; the 22 HTTP/provider/security/lifecycle cases and the earlier historical 70 tests are not added again. New proof covers namespaced IDs, sender/reply-target separation, web/provider origin, account-bound codes, selected-connection history and recovery, different adapter policies, private/group boundaries and migration safety. Migration checks preserve legacy identities/sources/actions/receipts, expire old unbound codes across up/down, and reject rollback when other-channel data, account/message-ID collisions, provider/web prefix ambiguity or reply-target data cannot fit the old schema.

Independent review also caught Meta wire values accidentally changed during renaming; adapter fixtures now assert `whatsapp_business_account` and `messaging_product: "whatsapp"`, and the corrected adapter passes its tests. Provider-specific HTTP failures are converted to a generic rejected reason/outcome at the adapter boundary. The normalized message key contract explicitly accounts for native IDs that are only unique within a chat.

At that portability checkpoint only the WhatsApp production adapter was registered. The second adapter was an in-memory contract proof. The following release-candidate checks supersede that provider limitation; broader Field Tools parity remains open. The backend remains the source of truth; no domain records or authorization policies were copied into adapters.

**Telegram release-candidate verification — 16 November 2026**

| Check | Result | Evidence boundary |
|---|---|---|
| Complete backend gate | **116 passed, 0 failed, 0 skipped; 26 entrypoints** | Fresh disposable PostgreSQL, all 219 migrations, isolated Redis; verified again in the release checkout based on deployed Staging |
| Both production adapters together | Passed inside the gate | Real server, Better Auth, verified WhatsApp/Telegram ingress, separate histories, text/voice review, confirmation/replay, source retention and independent unlinking; external services injected |
| Telegram transport | 12 provider tests passed | Receipt normalization, rejection versus uncertain delivery, file-ID aliases, trusted URLs/paths, MIME/size/stream boundaries and generic errors |
| Telemetry privacy | 2 tests passed inside the gate | Actual Sentry in-memory error/transaction envelopes omit Telegram credential URLs, secret header and both providers' raw webhook bodies; ordinary telemetry retained |
| Webhook setup helper | 6 tests passed inside the gate | Identity verification precedes registration; safe summaries, HTTPS callback, secret and message-only subscription checks; mocked Telegram |
| Backend and Panda Agent typechecks/builds | Passed | Primary and isolated Staging-based release; frontend dependencies resolve within the isolated checkout |
| Production portal image | Passed locally | nginx port, root/nested SPA, cache headers, missing assets, public API/login URLs and config validation; local Linux/arm64 image |
| Staging preflight | Passed | Public bot identity verified; credential and independent webhook secret stored in the selected Backend without triggering a deploy; required database/Redis/OpenAI/storage settings present |

Staging's WhatsApp credentials are absent; simultaneous live Meta delivery has not been established. The backend full-runtime tests prove shared behavior with the actual adapters but injected external calls. Real Telegram delivery, speech/model quality and a real signed-in hosted browser session require live checks. Deployment and webhook-registration evidence belongs in [RAILWAY.md](RAILWAY.md); local checks do not imply that rollout is complete.
