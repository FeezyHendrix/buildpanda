# BuildPanda Field — Agent Guide

Expo / React Native app for site crews. Offline-first: **only the sign-in screen
may require the network.** Everything past it reads from SQLite and queues its
writes.

## Before you mark any UI work complete

Run this checklist. Inconsistency has been the single most common defect in this
package — not broken code, but four screens each doing the same thing four ways.

- [ ] **Chrome** — every screen renders inside `<Page>`. No screen builds its own
      header, safe-area padding, or scroll container.
- [ ] **Create is a full page, never a bottom sheet.** `/tools/<thing>/new`.
      Sheets are for *switching* (workspace) or short confirmations, not for
      authoring a record.
- [ ] **Header actions** use `<HeaderIconButton>` with an Ionicon. Never a text
      glyph like `+`, never a bare `Button` squeezed into the bar.
- [ ] **Sub-tabs** use `<SegmentedTabs>`. One tab component in the app.
- [ ] **Text** goes through the `Text` atom with `weight` / `tone`. Never
      `react-native`'s `Text` directly — it won't carry Plus Jakarta Sans.
- [ ] **Colour** comes from `tailwind.config.js` (mirrors the web palette).
      No new hex in a component. `primary-500` is BuildPanda blue.
- [ ] **Touch targets ≥ 44px**, and ≥ 56px for primary actions — gloved hands.
- [ ] **Every list** has a loading state (`Spinner`), an empty state with a real
      sentence, and a pending-sync affordance where rows can be queued.
- [ ] `npx tsc --noEmit` clean, and the app bundles.

## Read the web before inventing UX

`packages/frontend` is the spec. Plans/Documents mirrors its
`documents.tsx` (two groups, category folder cards). Schedule mirrors the
sidebar's schedule section. When a screen has no web equivalent, say so rather
than inventing one — three UX inventions here were wrong and had to be undone.

## Layers

```
api/<feature>.ts    DTOs + <feature>Api object. Only place URLs live.
api/client.ts       transport + auth header. Nothing else calls fetch.
db/schema.ts        Drizzle tables. Typed per feature — no generic blob table.
db/<f>-repository.ts local reads/writes + outbox enqueue, in one transaction.
db/outbox.ts        the single dispatcher that pushes queued work.
hooks/use-<f>.ts    useLiveQuery over SQLite + background refresh.
app/                screens. Never call fetch or drizzle directly.
```

## Offline rules

- A local write and its outbox row are inserted **in the same transaction**.
- Server pulls never overwrite a row with `isPendingSync = 1`.
- IDs for un-synced rows are prefixed `local_`; a child whose parent is still
  `local_` waits rather than pushing.
- `flushOutbox` is single-flight — concurrent flushes double-post.
- Use `expo-crypto`'s `randomUUID`; Hermes has no `crypto.randomUUID`.
- Storage is partitioned per user by **database file name**, not a filter column.

## Rendering

`useLiveQuery` re-runs on any write to the tables it touches. Scope queries to
one project, memoise the query object, and never call a state setter during
render.
