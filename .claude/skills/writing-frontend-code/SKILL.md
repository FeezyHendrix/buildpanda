---
name: writing-frontend-code
description: Use when writing, extending or reviewing frontend code in packages/frontend — pages, components, hooks, react-query data fetching, dialogs/forms, routing, or styling.
---

# Writing Frontend Code (BuildPanda)

## Overview

Tao-of-React principles adapted to this repo: **small named functional
components, state owned by whoever is responsible for it, server state in
React Query, presentation kept dumb.** Styling is Tailwind (not CSS-in-JS).
When in doubt, copy the proven slice: `pages/project/action-items.tsx` +
`hooks/use-action-items.ts` + `components/molecules/upsert-action-item-dialog.tsx`.

## Feature anatomy (the canonical slice)

```
pages/project/<feature>.tsx                    # default export, lazy-routed in App.tsx
hooks/use-<feature>.ts                         # useXs / useCreateX / useUpdateX / useDeleteX
hooks/query-keys.ts                            # xKeys factory: all/list/detail per project
components/molecules/upsert-<x>-dialog.tsx     # create+edit in one FormDrawer dialog
components/molecules/<x>-detail-dialog.tsx     # detail + comments
```

## Rules

**Components**
- Functional components only, always named (stack traces, DevTools). Atoms/
  molecules use named exports + `displayName`; pages use default exports
  (required by the custom `lazy()` in App.tsx).
- Atomic design: `atoms/` = primitives with variant/size unions
  (`type ButtonVariant = "primary" | ...`), `molecules/` = feature-named
  compositions (kebab-case files), `organisms/` = shell pieces (sidebars).
- Keep components small; extract mapped lists and any nested ternary into
  their own components. Helper pure functions live *above* the component and
  take values as arguments — no closures over state.
- Don't hardcode repetitive markup — drive nav groups, filters and status
  chips from `as const` config arrays (see `project-sidebar.tsx`).
- Destructure props; keep prop count ~5 or fewer — group related values into
  an object prop. Defaults in the destructuring, not `defaultProps`.
- Prefer hooks over HOCs/render-props; no nested render functions.

**State & data**
- Server state lives in React Query, nothing else: `useQuery` with a key from
  the `query-keys.ts` factory (`xKeys.list(projectId, status)`), `enabled:
  Boolean(...)` for dependent queries. Mutations invalidate via
  `qc.invalidateQueries({ queryKey: xKeys.all(projectId) })` in `onSuccess`.
- All HTTP goes through `api/client.ts` (axios, `withCredentials`, 401 →
  sign-in redirect). Never `fetch` directly from a component.
- Local UI state (open dialogs, form fields, filters) is `useState` in the
  owning component; reach for `useReducer` when several pieces change
  together. No new global stores without a strong reason.
- Keep presentational components stateless — pages own state and pass it down.

**Routing & access**
- New pages: lazy import in `App.tsx` + route entry. Company-only routes wrap
  in `RequireCompany`; signed-in routes in `RequireAuth`
  (`lib/route-guards.tsx`). `accountType` only ever picks what users *see*
  (owners → `/my-build`); the backend decides what they can do.
- Project pages live under `/project/:projectId` and read context from
  `project-layout.tsx`; add nav entries in `project-sidebar.tsx` config (and
  the owner nav variant when owners should see it).

**Forms & dialogs**
- Create/edit share one upsert dialog on `FormDrawer` (`initial` prop decides
  mode; button label "Create" vs "Save changes"). Controlled inputs; surface
  `mutation.error?.message`; reset state on success/close.

**Styling**
- Tailwind utility classes with the theme palette (`primary` scale `#004DE7`,
  Plus Jakarta Sans). Match neighbouring files' tokens; use `cn()` from
  `lib/utils.ts` for conditional classes. No CSS-in-JS, no new style systems.

**Imports & files**
- `@/` alias for everything not co-located; kebab-case filenames; export
  shared types next to components (`export { Button, type ButtonProps }`).

**Performance**
- Don't optimize prematurely: no `memo`/`useCallback` walls without a
  measured rerender problem. Do hoist fixed arrays/objects to module-level
  constants. Heavy pages are already route-split — keep big libs (charts)
  inside lazy pages.

## Quick reference

| Need | Use |
|---|---|
| Fetch a list | `useQuery({ queryKey: xKeys.list(...), queryFn })` in `hooks/use-x.ts` |
| Create/update/delete | `useMutation` + invalidate `xKeys.all(projectId)` |
| New page | lazy import + route in App.tsx (+ guard wrapper) |
| New nav item | config array in `project-sidebar.tsx` / `sidebar.tsx` |
| Create+edit form | `upsert-x-dialog.tsx` on `FormDrawer` with `initial` |
| Conditional classes | `cn("base", cond && "extra")` |
| Status display | `Badge` atom with tone mapped from status |

## Common mistakes

- Calling axios/fetch inside a component instead of a hook in `hooks/`.
- Inventing ad-hoc query keys — always extend the factory in `query-keys.ts`.
- Forgetting invalidation after a mutation (stale lists).
- `&&` rendering that can leak `0`; use ternaries.
- Gating UI on `accountType` and assuming it's secure — it's presentation.
- Separate "create" and "edit" dialogs — one upsert dialog, `initial` prop.
- Hex colors that drift from the theme; check the Tailwind palette first.
