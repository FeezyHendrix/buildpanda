**Panda Agent — implemented Field Tools scope, 16 November 2026**

`packages/panda-agent` is the app in the main monorepo. The existing backend owns the shared engine in `modules/messaging-agent`; WhatsApp and Telegram are adapters of that engine. One configured Panda account per channel can serve multiple companies, with each linked sender restricted to their authorized workspace, project and optional real building. The backend models, migrations, request schemas, effective grants and domain services remain the source of truth.

The current local implementation covers **53 canonical action kinds: all 52 shared mobile action kinds plus standalone `raise_activity_delay`**, and **60 explicitly allowed read tools: 45 existing reads plus 15 full-record readers**. These counts describe the implemented catalog, not 451 completed features or every backend endpoint. Local release verification passed 238/238 backend tests (zero skips, 47 entrypoints) after 224 migrations on a fresh disposable database; backend/frontend/agent production builds and typechecks and the all-53-schema production-browser fixture passed. Deployment of this expanded release and live Staging acceptance remain pending; see [VERIFICATION.md](VERIFICATION.md) and the deployment owner's [RAILWAY.md](RAILWAY.md).

**Implemented actions and reads**

| Family | Action kinds | Canonical execution and local evidence |
|---|---:|---|
| Site records | 16 | Daily entries/templates and headers, diary-entry voids, material receipts/usage/reversals, material orders/deliveries, approvals/comments/decisions/reopening/resubmission, expenses. `field-actions/site-records.ts`, `site-records-db.test.ts`, `material-log-db.test.ts` |
| Work coordination | 19 | RFI create/edit/transition/comment/proposed or official response; change and look-ahead create/edit/delete/comments; activity logging, stage transitions and task create/edit/move/delete/comment. `field-actions/work-coordination.ts`, `work-coordination-db.test.ts` |
| Collaboration and drawings | 17 | Channel/direct/reply messages; project updates/comments; document registration/rename/revisions/open/download/delete; drawing annotation/comments/resolve/delete. `field-actions/collaboration.ts`, `collaboration-db.test.ts` |
| Additional mobile manual action | 1 | Standalone delay with its real reason/start time and canonical delay/EOT rules; no invented hours or diary. `field-actions/site-backend-records.ts`, `site-records-db.test.ts` |
| Authorized reads | 60 | Explicit read allowlist; 15 new domain readers include full RFI/change/approval/order/task/day/look-ahead/activity/document/drawing/expense/conversation/stage/key-date/ledger details. `field-actions/read-tools.ts`, `read-tools-db.test.ts`, `messaging-agent/tool-discovery.test.ts` |

Source/test paths in this document are relative to `packages/backend/src/modules/`. `field-actions/tools.ts` composes the action handlers, canonical schemas, field descriptors and permission/feature requirements. The shared `packages/voice-actions` catalog supplies the 52 mobile kinds; the backend adds the standalone delay. Legacy task/RFI AI write shortcuts are excluded from messaging discovery.

Supported action reviews expose the canonical request fields, including nested structures, explicit null/zero/false values, multi-assignees, long paragraphs, sanitized rich HTML and its plain-text mirror, templates/responses, dates, choices and authorized file IDs. Unsupported or unknown fields block confirmation. Named reviewers, immutable decisions, order/delivery state, task ownership/assignment, exact drawing revisions and conversation membership remain domain rules. The ledger validates its `numeric(14,2)` quantity contract before proposal/commit; ordinary REST receipts use the canonical service's existing Approved default rather than an invented Pending state. Order receipts require their explicit matching unit. Expense capture requires explicit currency, rechecks the project’s current currency and rejects mismatches without converting the amount.

Drawing annotations accept explicit pin/pen/cloud/measurement geometry on a selected document/version/page. An annotation may include a reviewed RFI or material-approval follow-up: the backend creates the real pin first, uses its ID and original revision for the child record, and rolls both back together on failure. A model cannot supply a future pin ID or choose inaccessible child actions.

**Text, voice, files and review**

1. Sign in with an existing BuildPanda account, select a configured channel/account and authorized project, then link using a ten-minute, single-use account-bound code. A building is required by building-scoped actions; project-scoped material capture does not grant diary/building visibility.
2. Send text, a completed voice note, or a supported photo/document/video with an optional caption. Both text and translated voice enter the same planner/review path. Voice processing begins after provider delivery; it does not stream from an actively recording WhatsApp/Telegram microphone. The original audio is retained, and the speech helper's English translation is labeled separately.
3. Missing facts produce a durable clarification, retaining earlier turns and completed proposed actions. Incomplete tanker/sand deliveries remain material intents until actual material, positive quantity and unit are supplied; expected arrival and actual occurrence are distinct. A new unresolved turn invalidates the older Confirm action.
4. Review and correct the typed fields in chat or the app. The app uses the shared rich-text editor and file picker. Provider attachments and multipart app ingress use canonical file staging/storage limits and ownership; permission and selected scope are checked before provider fetch. Retry reuses the retained original. Original voice files are not automatically offered as evidence.
5. Confirm the exact proposal/version, or use Cancel. Native buttons are supported by both adapters. Long reviews are split without losing content; only the final bounded part has buttons, earlier failed/uncertain parts block later buttons, and every part is fenced against the current proposal and grants.
6. Confirmation reauthorizes current access and commits canonical writes, action receipts and completion in one transaction. Concurrent confirmation/replay returns stored results. External notifications/jobs wait for the outermost commit and do not run after rollback.
7. Read questions use authorized tools and remain reads. Task/expense ownership, external shared-RFI visibility, channel membership, workspace Messages grants and linked-record permissions are enforced. Read execution avoids lazy board/channel/contract initialization. Queued answers and history are withheld after relevant grant, feature, assignment or visibility changes.

Successful `open_document`/`download_document` results expose a generated, authenticated exact-revision artifact link. The app fetches bytes with the current session, previews supported PDF/raster files and downloads an actual local blob. Other formats use a safe authenticated handoff. Channel receipts say the revision is ready and requires sign-in; they do not claim a provider file was delivered or downloaded. `messaging-agent/artifacts.ts` never trusts a model-provided URL or exposes storage paths/tokens.

**Shared engine and adapter boundary**

The core owns fresh actor/scope authorization, planning, canonical validation, durable versioned reviews, inbox/outbox, receipts, recovery and history. Adapters own webhook verification, native ID namespaces, sender/reply destinations, media retrieval, callbacks, reply eligibility/limits and send outcomes. Telegram and WhatsApp share the same core; a future adapter implements `MessagingChannelAdapter`, verified normalization and registration in `messaging-agent/adapters/index.ts` without copying domain logic.

IDs are scoped by channel and receiving account; Telegram chat identity is included where native message IDs are only chat-local. Link codes cannot cross accounts. Scope changes cancel pending work instead of moving it; user, connection/account and project isolate app caches/history. Only private/direct provider ingress is enabled. Group audiences require separate membership/disclosure handling.

Unknown send acceptance is quarantined rather than automatically resent. WhatsApp's reply window belongs to its adapter and requires actual provider ingress; app activity does not extend it. Stale web captures fail visibly with the original file retained, while stale provider captures remain recoverable under their original identity/scope. Original staged file metadata can survive a storage/DB interruption; storage itself is not part of the SQL transaction.

**Protocol and device boundaries**

| Interaction | Current equivalent and boundary |
|---|---|
| Camera/microphone/file selection | Provider media or an explicit app/OS file picker stages real authorized bytes. This is not proof of physical-camera behavior or live speech quality. |
| Drawing gestures, calibration, layers, comparison, zoom/pan | Exact stored geometry/revision reads and actions are supported; rich viewer gestures remain an authenticated BuildPanda viewer/device workflow. They are not all recreated in chat. |
| Native offline records/files and sync | Existing mobile permission snapshots/outbox remain mobile features. Panda Agent's durable server inbox/retry is not native offline parity or proof of disconnected device behavior. |
| Device home customization | Remains a mobile-device setting, not a project-record mutation exposed through the agent. |
| Backend-only/platform/commercial operations | Remain explicitly scoped in [coverage.csv](coverage.csv) and [backend-scope.csv](backend-scope.csv); 53 action kinds do not authorize arbitrary API calls. |

**Run and verify locally**

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:backend
pnpm dev:agent
```

The app defaults to port 5175 and proxies `/api` to the existing backend. Configure public origins, Better Auth/CORS, PostgreSQL, Redis/worker, AI/speech, storage and channel credentials using `.env.example` and [RAILWAY.md](RAILWAY.md). No credential belongs in these documents.

```sh
MESSAGING_AGENT_TEST_DATABASE_URL=postgres://... \
MESSAGING_AGENT_TEST_REDIS_URL=redis://... \
pnpm --filter @buildpanda/backend test:messaging-agent
```

The checked-in gate requires disposable migrated infrastructure and all 47 named entrypoints. The final run passed 238 tests with zero failures/skips. Local suites use injected model/provider/storage boundaries where specified; a separate configured AI probe passed 8 synthetic text cases plus one actual Whisper-to-planner voice case (9/9), without construction-record writes or provider sends. Builds/typechecks and the production-browser fixture passed; deployed real-user/provider/storage acceptance remains separate. Coverage status `evidenceLocalVerified` marks only explicitly evidenced catalog/semantic rows, with live-provider validation still pending.
