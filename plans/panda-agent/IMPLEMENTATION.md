**Panda Agent — channel-independent refactor, 15 November 2026**

The app lives in `packages/panda-agent` inside the main monorepo, with the shared engine in the existing backend at `modules/messaging-agent`. The first daily-log implementation was verified on 14 November; the 15 November refactor makes the channel a transport boundary and is verified separately below. This milestone covers daily site notes and daily-log headers. The complete Field Tools scope in [PLAN.md](PLAN.md) remains the target; completing this milestone does not establish full parity or live provider readiness.

**Core and adapter boundary**

| Shared core | Adapter owns |
|---|---|
| Current actor permissions and workspace/project/building scope | Provider credentials and account configuration |
| Text/retained-voice normalization, planning and canonical validation | Provider request verification and event decoding |
| Versioned proposals, edits, confirmation and domain execution | Native sender/message/media IDs converted to normalized input |
| Durable inbox/outbox, action receipts, retry and scope fencing | Media retrieval, outgoing messages and delivery-status decoding |
| Account/connection selection and protected operator UI | Link presentation, reply eligibility, message limits and formatting |

A sender is identified by channel, receiving provider account and opaque sender ID. Reply destinations are adapter-verified transport data, not model-chosen actors; non-private/group conversations require explicit audience/membership handling before enablement. Messages and delivery IDs use the same channel/account namespace. `providerMessageId` is adapter-normalized and unique within that namespace, not necessarily a raw native integer. For example, Telegram defines message IDs within a chat, so its adapter must include chat identity when normalizing and reverse that mapping for API replies/status correlation. [Telegram message contract](https://core.telegram.org/bots/api#message). Link codes are bound to their intended channel and account; a code made for a WhatsApp number cannot attach an unrelated bot or provider identity. App history, proposals and caches remain tied to the selected connection as well as user and project.

The first production adapter remains WhatsApp. Telegram or another provider can be added through the adapter contract while sharing the planner, review, canonical execution and recovery code. A second in-memory adapter is a contract test, not a shipped Telegram integration. WhatsApp's 24-hour reply window, numeric business-number configuration and Meta signatures belong to that adapter and must not become shared-core rules.

Existing WhatsApp data is preserved by a forward migration into provider-neutral tables. Existing identities and messages are labeled `whatsapp`; old unconsumed codes are durably expired because the prior schema did not bind a receiving account; users generate fresh account-bound codes. Expiry remains effective if the migration is rolled back. Rollback must reject incompatible other-channel data instead of discarding or silently relabeling it. Backend construction records are not duplicated or renamed by this migration.

**Adding another channel**

1. Implement `MessagingChannelAdapter` in `modules/messaging-agent/adapters/<channel>/adapter.ts`: stable `channel`/`channelAccountId`, display label, `maxTextLength`, `connectUrl`, `canReply`, `sendText` and `downloadAudio`. Send outcomes are provider-neutral accepted, rejected-with-reason or unknown; a channel does not need HTTP status codes in the shared contract.
2. Add that adapter's webhook parser/verifier. After actual provider verification, normalize native IDs/media and call `messagingAgentIntake(db).receive({ channel, channelAccountId }, events)`. Admission pins every event to that verified account, rejects external web-origin claims and preserves the provider timestamp while bounding the actual inbound reply clock. `providerMessageId` must include any narrower native chat/account uniqueness domain and be decoded inside the adapter when calling a reply API.
3. Register its configured factory in `configuredMessagingAdapters()` and its verified webhook plugin in `messagingAdapterRoutes`, both in `modules/messaging-agent/adapters/index.ts`. Add credential parsing/configuration there as needed. Only provider routes use the server-owned `messagingWebhook` route flag; that flag excludes browser-specific hooks and is not provider authentication. The shared planner, review service, daily-log executor, durable worker and app do not gain provider-specific branches.
4. Keep the actor sender ID distinct from the verified reply destination and label conversation type. The current engine processes private/direct conversations; group/thread audience and membership authorization must be implemented before such ingress is enabled. Run common behavior and adapter contract checks for colliding native IDs, mismatched account-bound codes, opaque sender IDs, selected-connection isolation, reply eligibility/limits and uncertain-send outcomes. Add real provider/staging checks before enabling it for users.

**Working flow**

1. Sign in with an existing BuildPanda account and open Panda Agent on port 5175.
2. Choose a configured channel/account, an authorized project and a real building. Generate a ten-minute, single-use code and connect through that adapter's link or code flow. For the first WhatsApp adapter, send it to the shared Panda number.
3. Send text or a completed voice note. The selected adapter verifies provider delivery before accepting a normalized durable inbox record. WhatsApp verifies the original bytes; recordings are processed after provider delivery, not streamed while the microphone is recording.
4. Voice capture retains the original recording and labels the existing speech helper's English translation separately. Text and translated voice use the same daily-log planner, canonical validation and versioned review.
5. Review the selected project, building, work date and proposed fields. Correct by message or in the app. Confirm the exact review ID/version, or cancel. No daily-log write occurs during drafting.
6. Confirmation rechecks current grants and scope, and commits the canonical daily-log writes and action receipts in one database transaction. Concurrent confirmation and replay return the stored result.
7. Failed incoming messages can be retried in the authenticated app while their original identity and scope remain valid. Source recordings are reused. A successful retry creates a new review reply rather than reusing an earlier error reply.

**Backend authority and boundaries**

The new `field-actions` daily-log executor uses the existing daily-log request schemas, repositories and services. It preserves nulls, zeros, paragraphs, HTML sanitation, canonical workforce bounds, template semantics and file authorization. The simple channel planner generates only text notes and supported header fields; it cannot invent templates, file references or rich markup. Reviews containing fields or formatting outside the app editor's supported controls are blocked from confirmation there.

Every protected app read, proposal, commit and retry uses fresh effective permissions. The worker does not inherit a browser's active workspace. Inbox and proposal rows retain their original workspace/project/building and scope version; changing projects cancels pending work rather than moving it. Cache keys include user, selected channel/account/connection and project, and unknown or denied access hides protected views and actions.

Supporting backend fixes thread building selection through daily void/PDF/email operations and prevent new entries/activity links on voided days. Atomic daily-log creation and parent-row locks also protect competing app/messaging-agent writers and concurrent voids. These backend repairs do not enable agent void, report or activity-link commands. Queue lifecycle fixes prevent duplicate repeating workers and stop local polling on close. A reproduced existing Redis subscription/startup shutdown rejection is also handled.

Outbound replies require an active connection, opt-in, current scope and current project/building access, then the selected adapter's reply policy. The WhatsApp adapter also requires an actual incoming WhatsApp message within its 24-hour window; opening the app or creating an app draft does not extend that window. Other channels must use their own verified delivery rules. Unknown provider acceptance is quarantined and never automatically resent. Explicit provider rejection, including 429, is retained as failed; automated resend and template messages remain outside this milestone.

**Previous milestone verification — 14 November 2026**

The original `test:whatsapp` entry point requires isolated PostgreSQL and Redis URLs and fails if a named suite is missing. It covers migration up/down, signed raw intake, inherited parser bypass attempts, linking, company/sender isolation, current grants, original audio retention, source retries, versioned editing, simultaneous confirmation, whole-batch rollback, stale scope, opt-out, service windows, provider replay, uncertain delivery and worker shutdown.

Three implementation review passes covered canonical models/execution, transport/persistence, and independent security/runtime integration. The independent review reproduced an encrypted-content parser bypass, then verified the fix returns 415 before any database transaction. Signed webhook source text is retained before browser sanitation/file-reference hooks; canonical file checks still run at execution.

The previous WhatsApp-only app passed its production build and a real Chromium interaction check against fixture transport: linking, unlinked multi-building selection, explicit project changes, corrections, stale versions, receipts, cancellation, read-only/denied access, same-project account switching, multiline HTML mirrors, unsupported review fields and failed-message retry. This browser check does not verify a real Better Auth session or Meta connection.

The previous backend gate passed 70 tests with zero skips before this refactor; that count is historical and is not proof of the new generic contracts. Its full-server test signs in through real Better Auth, verifies the new app's trusted origin/CORS, links through signed intake, drafts through the worker, and confirms exactly once through the real HTTP route. Provider/model calls remain injected. An additional 8 existing template tests passed; backend and app typechecks/builds passed. Detailed evidence is recorded in [VERIFICATION.md](VERIFICATION.md). Full Field Tools acceptance gates remain open.

**Current refactor verification**

The generic backend gate passes **82 tests, zero failures and zero skips across 19 checked-in entrypoints**. It verifies provider/account ID collision isolation, channel/account-bound codes, selected-connection history and cache isolation, data-preserving migration/guarded rollback, and the same text/voice review/confirmation flow through a second in-memory adapter with a different reply policy. The full-backend test uses real Better Auth, the actual WhatsApp HMAC boundary, the generic connection API, canonical confirmation/replay and unlinking.

Backend typecheck/production build and Panda Agent typecheck/production build pass. The Chromium fixture smoke and frozen offline package install pass. These results apply to the current generic first daily-log slice; they do not establish a live Telegram integration, live Meta/model quality or full Field Tools parity. [VERIFICATION.md](VERIFICATION.md) records the details and the historical 70-test result separately.

**Run locally**

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:backend
pnpm dev:agent
```

The app proxies `/api` to the existing backend. Sign in with your existing BuildPanda account in Panda Agent. Separate API origins must allow the new app origin in `CORS_ORIGIN` and Better Auth's trusted origins. The default local origins include port 5175. Direct sign-in establishes the API cookie from the agent's own browser context, including when the agent uses a separate Railway domain.

To enable the WhatsApp adapter, supply the Meta credentials documented in `.env.example`, an explicitly pinned Graph API version, the existing AI/speech credentials and working S3 storage. Production also requires Redis and an enabled queue worker. Configure Meta's verification callback at `<backend-origin>/whatsapp/webhook` and subscribe to message events. Credentials are not included in the implementation.

Run the backend gate only against disposable infrastructure with existing migrations applied:

```sh
MESSAGING_AGENT_TEST_DATABASE_URL=postgres://... \
MESSAGING_AGENT_TEST_REDIS_URL=redis://... \
pnpm --filter @buildpanda/backend test:messaging-agent
```

For the browser check, start `pnpm dev:agent` and run `pnpm --filter @buildpanda/panda-agent test:smoke`. Its HTTP transport is intentionally a fixture; no external messages are sent.

**Still open**

- Remaining Field Tools operations, authorized record search/history, forms with attachments/templates and visual workflows.
- Human takeover/operator tools, scheduled reminders, workspace quotas, outbound templates and reconciliation tooling.
- Remaining backend contract gaps, including document visibility and competing ledger transitions, before enabling those actions.
- Live Meta account verification, real audio/model quality, real login/browser integration, provider callback ordering and deployment infrastructure checks. The Telegram production adapter is now implemented; rollout evidence is tracked in the Railway runbook.

The coverage register uses `partial_local_verified` for implemented subsets with local proof. It does not count an entire API, work package or acceptance gate as complete because its first daily-log variant works.

**Telegram release candidate — 16 November 2026**

WhatsApp and Telegram now register independently against the same production engine. Telegram supports private-chat text, voice notes and audio, channel-bound deep linking, namespaced message/reply IDs, explicit confirmation and connection-specific unlinking. Group, business and thread/topic messages are excluded until their audience rules are implemented. Provider downloads validate trusted paths, MIME and bounded size, while accepting Telegram's canonical file-ID aliases. Bot-token URLs, webhook secrets and raw provider payloads are excluded from error telemetry.

The final backend gate passes **116 tests, zero failures and zero skips across 26 entrypoints** on fresh disposable PostgreSQL/Redis. Both production adapters are exercised together through the real backend and Better Auth with only external transport, speech and storage seams injected. Backend and agent typechecks/builds pass. The portal image passes a local nginx smoke check; the direct sign-in form uses the existing Better Auth endpoint.

The user selected the existing Staging Backend and authorized storing the supplied Telegram credential. Its public bot identity was verified before Railway storage. Staging already has database, Redis, OpenAI and audio-storage configuration; its Meta credentials are absent, so WhatsApp remains disabled there until configured. The isolated release starts from Staging commit `0875f3f0e061ec0c6e012cdbce28801bfcc98007`, preserving Staging's newer changes. See [the rollout runbook](RAILWAY.md) for live deployment status and remaining checks. This release still covers daily site notes and daily-log headers rather than every Field Tools operation.
