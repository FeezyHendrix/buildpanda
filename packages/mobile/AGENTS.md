# BuildPanda Field — Agent Instructions

Follow the [repository RBAC requirements](../../AGENTS.md#rbac-is-foundational)
and the mobile conventions in [CLAUDE.md](CLAUDE.md). RBAC governs mobile views,
navigation, data access, and actions, including offline use.

## Adaptable mobile views

Follow the [adaptable-view and clean-abstraction requirements](../../AGENTS.md#adaptable-views-and-clean-abstractions).
Use declarative feature/action definitions with shared view, navigation, query,
and repository guards. Screens describe their requirements; shared policy
adapters determine availability. Evaluate the existing pattern before extending
it, preserve read-only experiences, and keep record-level rules separate from
presentation. No per-screen role matrices or duplicated permission logic.

## Mobile permission requirements

- Consume the server-computed project access map through the mobile API/hook
  layers. Keep a permission snapshot scoped to the current user, organization,
  and project, with the freshness and invalidation rules required by the root
  guide. Do not create mobile-specific role defaults.
- Gate tabs, tool cards, screens, deep links, action controls, and voice-capture
  actions using the actual resource/action. Gate data loading and local cache
  reads as well as rendering. Unknown or denied access cannot expose content.
- Check permission before local mutations and outbox insertion. Keep server
  checks on sync and handle revocation explicitly. Offline support never means
  showing every tool or allowing every action until the backend rejects it.
- Verify permitted and denied roles, direct navigation, cold starts with no
  access snapshot, offline use, reconnect, revocation, and scope changes for
  the permission paths being changed.

## Shared implementation pattern — 2026-10-14

- `src/lib/feature-access.ts` declares resource/action requirements, including
  workspace messaging and server-derived record capabilities. It is a mapping
  to API contracts, never a second role matrix.
- `access-policy.ts` and `access-requirement.ts` evaluate typed requirements.
  `project-access-store.ts` issues scoped generation tickets so asynchronous
  results cannot cross a permission or identity change.
- `access-session.ts` owns freshness, reconnect, revocation, and cleanup races.
  `project-access-provider.tsx` adapts native connectivity, storage, and React.
  Cached server verification lasts **24 hours maximum**. Reconnect blocks
  protected work until verification finishes. Known changes block old access
  before asynchronous cleanup; unsent authored records remain quarantined.
- `mobile-routes.ts` and `withProjectPermission` guard direct navigation.
  `PermissionGate`, `Button`, and `HeaderIconButton` adapt content and actions.
  A guarded child does not mount before its access is known.
- `usePersistentQuery` requires an explicit permission and project scope.
  `permission: null` is reserved for online workspace/project discovery.
  `repositoryAccess` guards SQLite reads and transactional writes/enqueueing.
  Record guards preserve requested reviewers, exact drawing revisions,
  task assignment, and RFI internal/shared visibility.
- `apiRequirement` and `outboxRequirement` map transport/queue operations back
  to the catalog. Refresh access before dispatch and independently authorize
  every write on the server. Retrying or discarding queued records is guarded.
- Native downloaded files are partitioned by user, workspace, project, and
  resource area. Conversation data and attachment reopening require an online
  membership check; the 24-hour project snapshot does not verify membership.
- Add new features to these definitions and adapters. Do not add screen-specific
  role branches, infer write access from `manage`, or depend on an eventual 403.

## Verification and remaining boundaries

The original missing mobile access consumer, unfiltered tabs/tools, direct-route
bypass, and locally unguarded approval decisions are implemented and covered by
`pnpm --filter @buildpanda/mobile test:rbac`. The suite uses the actual SQLite
migrations and repositories, plus access lifecycle and route-policy tests.

Backend verification:
`pnpm --filter @buildpanda/backend exec tsx --test src/lib/mobile-rbac.test.ts src/modules/panda-ai/agent/tool-permissions-gate.test.ts`
checks access-map/API agreement, participant overrides (including empty grants),
workspace/project messaging, realtime delivery, file access/attachments, and
voice/AI permission filtering. HTTP guard tests use Fastify injection with
repository fixtures.

An isolated PostgreSQL instance with all 215 migrations also verified the file
reference queries and internal/shared RFI and proposed-response attachment rules.

Browser verification exercises allowed read-only RFIs, hidden forbidden controls,
blocked creation deep links, unknown access, revocation of cached content, and
workspace Messages view without send. Mobile web/iOS export and all three
changed package typechecks are required alongside permission tests.

Native device lifecycle and file deletion still need device integration testing.
These checks are not a claim that every pre-existing backend or Panda AI feature
has received an exhaustive RBAC audit.

## Voice coverage — 2026-10-14

The shared catalog now declares **52 action kinds**: the original 21 site-record
operations plus 31 covering task creation/editing/assignment/status/deletion/comments,
expenses, material requests/decisions/reopening/comments/deliveries, official RFI
responses, messages/DMs/thread replies, project updates, documents/revisions,
and drawing pins/comments/resolution/deletion.

- `packages/voice-actions` is framework independent and shared with the backend.
  `src/lib/voice/execute.ts` requires a handler for every added action kind.
  Review forms adapt to catalog fields; handlers use existing API/repository layers.
- Only authorized target labels enter classification and review. Unknown IDs,
  invalid dates, invalid amounts, and cross-board moves require correction.
  Picked attachments are supplied by the reviewer, never by the model.
- Pins are tied to the selected revision and page. Pin text and outbox operations
  are stored atomically. Approved/rejected material requests stay immutable;
  only Resubmit requests can return to Pending.
- Online task/document/update changes reconcile local caches. A cache refresh
  failure after a committed write is reported without retrying that write.
- `pnpm --filter @buildpanda/mobile test:voice` exercises all 31 new executors with
  actual SQLite repositories and API wrappers; HTTP and native file/platform
  boundaries are fixtures. It covers denied/expired/revoked/switching access,
  offline restrictions, reviewer/revision checks, field validation and retries.
- Backend voice tests: `coverage.test.ts` and `context-db.test.ts` under
  `packages/backend/src/modules/panda-ai/voice-report`. The latter requires
  `VOICE_TEST_DATABASE_URL` pointing to an isolated migrated PostgreSQL database;
  fixtures roll back. It exercises context scope and direct task API guards.

This is action-contract coverage, not a guarantee that speech recognition or the
model will understand every utterance. Physical-device recording, file transfer,
and filesystem cleanup still need device integration testing. Browser review
checks use a fixture classification response; they do not call a live speech model.

Voice review preserves the destination field types: short/long text, rich text
with HTML/plain-text mirrors, numbers, dates, choices, booleans, and picked files.
The renderer and validators reject unsupported types. Required fields remain
visible; empty optional details expand on demand. Daily-log form definitions
travel with the server-derived proposal so corrected answers can be queued
without depending on a previously downloaded template. Regression tests and a
390px browser review cover formatting, blank rich content, false answers,
paragraphs, required details, and partial retries.
