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
  reads, writes, or outbox enqueueing. Define bounded freshness and invalidation
  when implementing offline access caching; a cached login is insufficient.
  Refresh access on reconnect and reauthorize queued work on the server. A
  later sync rejection is a fallback, never the first permission check.
  Revocation cannot be discovered while disconnected, so do not claim immediate
  offline revocation. Once denial/revocation is known, stop affected reads and
  writes and remove access to cached protected data and downloaded files.
  Isolate permission/data caches across user, workspace, and project switches
  and invalidate them appropriately on sign-out or permission changes.
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

## Recorded implementation gaps

The inspection on 2026-10-14 found that mobile does not consume the project
access map to gate its views and actions. Details and required follow-up are
recorded in [packages/mobile/AGENTS.md](packages/mobile/AGENTS.md).
This is an unresolved implementation gap, not an accepted offline convention.

The frontend helpers `canViewSection`, `canViewResource`, and
`canResourceAction` in `packages/frontend/src/lib/project-types.ts` also return
`true` when access is missing. Their callers must not treat that behavior as
the intended RBAC contract. Correct and validate these paths to deny unknown
access; this instruction update does not change their runtime behavior.

## Maintaining skills

Keep this requirement linked near the start of every project-local `SKILL.md`,
including `.agents/skills`, `.claude/skills`, and both mobile skill directories.
Preserve the link when adding, copying, or updating skills. Domain examples
must also enforce RBAC; a general reminder does not excuse an unsafe example.
