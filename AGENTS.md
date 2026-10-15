# BuildPanda — Agent Instructions

Use [CLAUDE.md](CLAUDE.md) for the project map and package conventions. The RBAC
requirements below apply across every package and every project-local skill.

## RBAC is foundational

**User requirement recorded 2026-10-14:** RBAC is the bedrock of BuildPanda.
Every protected feature must respect it across web, mobile, admin, backend,
offline storage/sync, and Panda AI. Permission enforcement is part of a
feature's definition of done.

- **Identify the permission before implementation.** Map each protected view,
  read, and action to its resource/action and organization/project scope.
  Viewing, creating, editing, deleting, approving, commenting, uploading, and
  downloading may require different permissions. Preserve record-level rules,
  such as a named reviewer or restrictions on approving your own request.
- **Enforce both client and server behavior.** Hide forbidden navigation, tabs,
  tools, content, and actions; guard routes and deep links independently of
  navigation. Gate protected queries, prefetches, cached reads, and mutation
  handlers. The backend must independently authorize protected reads, writes,
  downloads, sync operations, and AI tool calls before returning data or
  applying side effects. Check that referenced records belong to the authorized
  scope. UI visibility alone is never the security boundary.
- **Use the existing permission system.** Backend resource checks belong in
  `packages/backend/src/lib/authorization.ts`; project routes use
  `request.requireProjectPermission(projectId, resource, action)`. The access
  response from `GET /projects/:id/access` is computed in
  `packages/backend/src/modules/participants/access.ts` and must agree with
  backend enforcement. Reuse effective organization permissions and participant
  grants/overrides; do not invent a separate client role matrix or infer access
  from `accountType`, a role label, sign-in, project selection, or feature flags.
- **Deny access until permission is known.** Loading, missing, failed, expired,
  or invalidated access must not grant protected visibility or actions. An
  eligible cached access snapshot may support offline use under the rules
  below. Keep permitted read-only views available while withholding actions
  the caller cannot perform.
- **Offline use must enforce RBAC.** Only an eligible server-derived permission
  snapshot for the current user, organization, and project may authorize local
  reads, writes, or outbox enqueueing. The user-approved maximum offline lifetime
  is **24 hours after server verification**. A cached login is insufficient.
  Refresh access on reconnect and reauthorize queued work on the server. A
  later sync rejection is a fallback, never the first permission check.
  Revocation cannot be discovered while disconnected, so do not claim immediate
  offline revocation. Once denial/revocation is known, stop affected reads and
  writes and remove access to cached protected data and downloaded files.
  Isolate permission/data caches across user, workspace, and project switches
  and invalidate them appropriately on sign-out or permission changes.
- **Direct messages require workspace Messages permission.** Conversation
  membership is also required. Project conversations use their project grants;
  direct messages use effective workspace `messages:view` and `messages:send`.
  Apply these rules to API reads/writes, attachment reads, and realtime delivery.
- **Task and expense visibility follows explicit grants.** Without `tasks:viewAll`,
  callers see only tasks they created or are assigned to. Without
  `finances:viewAllExpenses`, callers see only expenses they logged; no authored
  expenses means an empty result. Owner, Admin and Project Manager presets include
  these grants, and custom roles can configure them. Do not infer broad access
  from a role name. Apply the same scope to detail, files, reporting, offline
  caches and Panda AI.
- **Panda AI obeys the caller's permissions.** Filter available tools and
  authorize each execution with the same resource/action and scope checks as
  the equivalent API. Prompts and tool visibility do not replace execution
  guards; generated summaries must not reveal inaccessible data.
- **Verify allowed and denied behavior.** For affected permission paths, check
  authorized access, denied views/actions, direct URLs/deep links, direct API
  calls, unknown access, scope changes, and permission revocation. Include
  offline reads/enqueue/reconnect cases when changing mobile or sync behavior.
  Exercise the relevant role/grant combinations, including participant
  overrides. A successful admin flow or a passing typecheck alone is
  insufficient. Report gaps explicitly; do not mark them resolved by adding
  documentation or by relying on an eventual 403.

## Adaptable views and clean abstractions

**User requirement recorded 2026-10-14:** Build adaptable views through generic,
reusable patterns and follow clean code strictly. Evaluate the existing design
and any in-progress implementation before extending it.

- Declare feature and action requirements in a shared, typed policy catalog.
  Navigation, view sections, controls, route guards, queries, and mutations
  consume those definitions through reusable adapters; do not scatter duplicate
  permission mappings or role-specific rendering branches through screens.
- Keep permission evaluation, access lifecycle/cache invalidation, presentation,
  transport, and persistence as separate concerns with explicit interfaces.
- Views adapt from effective capabilities and record state. Keep record-specific
  rules explicit and reusable; a generic abstraction must not erase reviewer,
  status, ownership, revision, or scope constraints.
- Prefer small, composable abstractions grounded in actual repeated behavior.
  Avoid opaque wrappers, speculative frameworks, and duplicated source-of-truth
  maps. Review the design for clarity, testability, and allowed/denied behavior
  before expanding it or calling it complete.

## Implementation status — 2026-10-14

Mobile now consumes the project access response through a shared feature/action
catalog and reusable route, UI, query, repository, download, and queue guards.
The pattern and verification boundaries are recorded in
[packages/mobile/AGENTS.md](packages/mobile/AGENTS.md).

The frontend helpers `canViewSection`, `canViewResource`, and
`canResourceAction` now deny missing protected access and check the exact action.
Their implementation is in `packages/frontend/src/lib/project-types/project-access.ts`,
re-exported from the existing `project-types.ts` entry point.

## Maintaining skills

Keep this requirement linked near the start of every project-local `SKILL.md`,
including `.agents/skills`, `.claude/skills`, and both mobile skill directories.
Preserve the link when adding, copying, or updating skills. Domain examples
must also enforce RBAC; a general reminder does not excuse an unsafe example.

## Voice action extensions

The mobile voice flow uses `@buildpanda/voice-actions` for shared action metadata,
permission requirements, field definitions, target sources, and review validation.
Extend that catalog and the typed executor registry; do not add role switches or
independent permission maps in prompts, screens, or handlers. Existing business
services and offline repositories remain responsible for the actual records.

A spoken request is a proposal until reviewed. Resolve targets only from the
caller's authorized context, collect missing details, and require a file picker
for attachments. Never invent file paths, recipients, drawing positions, or
approval decisions. Preserve drawing revisions, named reviewers, immutable
approval decisions, task assignment, and conversation membership. Mark actions
that need a connection, and retain completed actions when retrying a partial batch.

Review fields must preserve the destination form's semantics: rich text retains
HTML and its plain-text mirror, long text preserves paragraphs, booleans remain
booleans, and choices/files use their own controls. Extend the shared typed field
contract, validation, and renderer together. Unknown field types must block the
action, never silently fall back to a text box. Missing or invalid required
inputs stay visible for correction before any record or queue write.
