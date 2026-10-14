# BuildPanda Field — Agent Instructions

Follow the [repository RBAC requirements](../../AGENTS.md#rbac-is-foundational)
and the mobile conventions in [CLAUDE.md](CLAUDE.md). RBAC governs mobile views,
navigation, data access, and actions, including offline use.

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

## Unresolved findings — 2026-10-14

These findings describe the inspected implementation. This instruction update
does not fix them. Update their status only after implementation and validation.

- `src/app/(tabs)/_layout.tsx` and `src/app/tools/_layout.tsx` check sign-in and
  project selection, without resource permission guards.
- `src/app/(tabs)/tools.tsx` renders every tool card without RBAC filtering.
- Mobile has no consumer of `GET /projects/:id/access`; its participant DTO
  contains no effective permission map.
- `src/app/tools/material-approvals/[id].tsx` exposes decisions based on record
  status and deliberately defers permission enforcement to outbox sync. Its
  comment describes current behavior and must not be copied as a design rule.
- Existing backend authorization does not resolve missing client visibility,
  route, cache-read, or enqueue guards. Use the existing access endpoint and
  backend resource/action checks to implement those guards, and audit the other
  mobile entry points instead of limiting the fix to the tools grid.
