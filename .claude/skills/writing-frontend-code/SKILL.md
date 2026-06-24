---
name: writing-frontend-code
description: Use when writing, extending or reviewing frontend code in packages/frontend — pages, components, hooks, react-query data fetching, dialogs/forms, routing, styling, or performance. House conventions are paired with React performance rules (adapted from Vercel Engineering) scoped to this client-rendered React Query SPA.
---

# Writing Frontend Code (BuildPanda)

## Overview

Tao-of-React principles adapted to this repo: **small named functional
components, state owned by whoever is responsible for it, server state in
React Query, presentation kept dumb.** Styling is Tailwind (not CSS-in-JS).
When in doubt, copy the proven slice: `pages/project/action-items.tsx` +
`hooks/use-action-items.ts` + `components/molecules/upsert-action-item-dialog.tsx`.
The examples below thread that one feature (`action-items`) through every
layer — it mirrors the backend's `action-items` module, so the DTO shapes line
up across the stack.

The house conventions are authoritative. The **Performance playbook** at the
end folds in React performance rules adapted from Vercel Engineering; where a
perf rule and a house convention ever appear to conflict, the house convention
wins (e.g. styling stays Tailwind + `cn()`, never inline-style batching). This
is a client-rendered React Router SPA, so the playbook drops the Next.js/RSC/SSR
rules that don't apply and maps the rest onto React Query, `React.lazy`, and the
axios client.

## Feature anatomy (the canonical slice)

```
pages/project/action-items.tsx                 # default export, lazy-routed in App.tsx
hooks/use-action-items.ts                       # useActionItems / useCreate.. / useUpdate.. / useDelete..
hooks/query-keys.ts                             # actionItemKeys factory: all/list/detail per project
components/molecules/upsert-action-item-dialog.tsx  # create+edit in one FormDrawer dialog
components/molecules/action-item-detail-dialog.tsx  # detail + comments
```

The factory is the single source of truth for keys; every hook derives from it,
and mutations invalidate through it. This is the React Query equivalent of the
backend's `repository`/`service` seam.

```ts
// hooks/query-keys.ts — one home for every key shape (DRY)
export const actionItemKeys = {
  all:    (projectId: string) => ["action-items", projectId] as const,
  list:   (projectId: string, status?: Status) => [...actionItemKeys.all(projectId), { status }] as const,
  detail: (id: string) => ["action-items", "detail", id] as const,
}

// hooks/use-action-items.ts — all HTTP via api/client.ts; never fetch() in a component
import { api } from "@/api/client"
export function useActionItems(projectId: string, status?: Status) {
  return useQuery({
    queryKey: actionItemKeys.list(projectId, status),
    queryFn: () => api.get(`/projects/${projectId}/action-items`, { params: { status } }).then(r => r.data),
    enabled: Boolean(projectId),            // dependent query guard
  })
}
export function useCreateActionItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertActionItem) =>
      api.post(`/projects/${projectId}/action-items`, input).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  })
}
```

## Rules

### Components

Functional components only, always named (stack traces, DevTools). Atoms and
molecules use named exports + `displayName`; pages use default exports (the
custom `lazy()` in `App.tsx` needs them). Atomic design: `atoms/` = primitives
with variant/size unions, `molecules/` = feature-named compositions (kebab-case
files), `organisms/` = shell pieces.

```tsx
// atoms/button.tsx — named export, variant union, displayName, defaults in destructuring
type ButtonVariant = "primary" | "ghost" | "danger"
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant }
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn("rounded px-3 py-1.5 text-sm", VARIANTS[variant], className)} {...props} />
}
Button.displayName = "Button"
export type { ButtonProps }

// pages/project/action-items.tsx — DEFAULT export, page owns state, children stay dumb
export default function ActionItemsPage() { /* ... */ }
```

Keep components small: extract mapped lists and any nested ternary into their
own component. Helper pure functions live *above* the component and take values
as arguments — no closures over state.

```tsx
// Bad — mapped list + nested ternary inline, hard to read and re-render
return <ul>{items.map(i => <li key={i.id}>{i.status === "done" ? "✓" : i.status === "open" ? "○" : "…"} {i.title}</li>)}</ul>
// Good — one row component, status mapping hoisted as a pure helper
const ICON: Record<Status, string> = { done: "✓", open: "○", in_progress: "…" }
function ActionItemRow({ item }: { item: ActionItem }) {
  return <li>{ICON[item.status]} {item.title}</li>
}
return <ul>{items.map(i => <ActionItemRow key={i.id} item={i} />)}</ul>
```

Don't hardcode repetitive markup — drive nav, filters and status chips from
`as const` config arrays. Destructure props; keep prop count ~5 or fewer (group
related values into an object prop). Prefer hooks over HOCs/render-props. Never
define a component inside another component (perf rule R-1).

**File size: 400 lines is the hard ceiling.** Any `.tsx`/`.ts` file over 400
lines must be refactored — split it before adding more. A page that has grown
past the limit usually hides several components in one file: extract each
non-trivial sub-component (card, dialog, picker, row), each `as const` config /
icon set, and any shared `ComboSelect`-style primitive into their own files
(`components/molecules/<feature>-<thing>.tsx`), leaving the page as a thin
composition root. Co-locate the pieces under the feature; keep the public
surface (the default-exported page) small. Splitting is also a render win — a
1000-line page re-renders as one unit; small components re-render independently.

### State & data

Server state lives in React Query, nothing else: `useQuery` keyed from the
factory, `enabled: Boolean(...)` for dependent queries, mutations invalidate
`actionItemKeys.all(projectId)` in `onSuccess` (see Feature anatomy). All HTTP
goes through `api/client.ts` (axios, `withCredentials`, 401 → sign-in
redirect). Local UI state (open dialogs, filters, form fields) is `useState` in
the owning page; `useReducer` when several pieces move together. Presentational
components stay stateless — the page owns state and passes it down.

```tsx
// Bad — fetch() in a component: no dedup, no cache, no 401 handling
useEffect(() => { fetch(`/api/projects/${projectId}/action-items`).then(/* ... */) }, [projectId])
// Good — the hook owns it; the page just consumes
const { data: items = [], isPending } = useActionItems(projectId, status)
```

Derive values during render; don't mirror props/server data into state via an
effect (perf rule D-2).

```tsx
// Bad — duplicates server state into local state and drifts
const { data: items } = useActionItems(projectId)
const [open, setOpen] = useState<ActionItem[]>([])
useEffect(() => setOpen(items?.filter(i => i.status === "open") ?? []), [items])
// Good — derive during render
const openItems = items.filter(i => i.status === "open")
```

### Routing & access

New pages: lazy import in `App.tsx` + a route entry, wrapped in the right guard
(`RequireCompany` for company-only, `RequireAuth` for signed-in,
`lib/route-guards.tsx`). `accountType` only picks what users *see* (owners →
`/my-build`); the backend decides what they can *do*. Project pages live under
`/project/:projectId` and read context from `project-layout.tsx`; add nav from
the `project-sidebar.tsx` config, not hardcoded markup.

```tsx
// App.tsx — lazy + guarded route
const ActionItems = lazy(() => import("@/pages/project/action-items"))
<Route path="/project/:projectId/action-items"
  element={<RequireCompany><ActionItems /></RequireCompany>} />

// project-sidebar.tsx — nav driven by an as const config (DRY), not repeated <Link> markup
const PROJECT_NAV = [
  { to: "action-items", label: "Action items", icon: ListTodo },
  { to: "queries",      label: "Queries",      icon: MessageSquare },
] as const
return PROJECT_NAV.map(n => <SidebarLink key={n.to} {...n} />)
```

### Forms & dialogs

Create and edit share one upsert dialog on `FormDrawer`; the `initial` prop
decides mode (button label "Create" vs "Save changes"). Controlled inputs;
surface `mutation.error?.message`; reset on success/close.

```tsx
// components/molecules/upsert-action-item-dialog.tsx — ONE dialog, not two
export function UpsertActionItemDialog({ projectId, initial, onClose }: Props) {
  const isEdit = Boolean(initial)
  const [title, setTitle] = useState(initial?.title ?? "")
  const create = useCreateActionItem(projectId)
  const update = useUpdateActionItem(projectId)
  const mutation = isEdit ? update : create
  return (
    <FormDrawer onClose={onClose} error={mutation.error?.message}>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      <Button onClick={() => mutation.mutate({ id: initial?.id, title }, { onSuccess: onClose })}>
        {isEdit ? "Save changes" : "Create"}
      </Button>
    </FormDrawer>
  )
}
```

### Loading & busy states

One loader for the whole app: the circular `Spinner` atom
(`components/atoms/spinner.tsx`). Never hand-roll `animate-spin`, dots, skeletons,
or "Loading…" text as a substitute — every busy indicator routes through
`Spinner` so the UI reads as one product.

- **Sizes**: `xs` (inline, inside controls), `sm`/`md`/`lg` (page/section). **Tones**:
  `brand` (default, blue on light surfaces), `current` (inherits text colour — use
  on solid/coloured fills so the spinner stays visible).
- **Buttons own their busy state via the `loading` prop** — never place a bare
  `Spinner` next to a `<Button>` or swap the label for "Saving…". `loading`
  disables the button, sets `aria-busy`, and overlays the spinner while keeping the
  label width so the layout doesn't jump. Wire it straight to the mutation's
  `isPending`.
- **`ConfirmDialog`** takes `loading` for destructive/async confirms: pass the
  mutation's `isPending`, keep the dialog open, and close it yourself in
  `onSuccess`/`onError`. This is what prevents double-submit on deletes.
- **Page/section loading** renders `<Spinner size="md" />` centred in the
  region (this is how route-split fallbacks and query `isPending` branches render).

```tsx
// Good — button drives its own busy state from the mutation
const save = useUpdateThing(id)
<Button loading={save.isPending}
  onClick={() => save.mutate(values, { onSuccess: onClose })}>
  Save changes
</Button>

// Good — confirm dialog stays open until the mutation settles
const remove = useDeleteThing(id)
<ConfirmDialog open={open} onOpenChange={setOpen} variant="danger"
  loading={remove.isPending} confirmLabel="Delete"
  onConfirm={() => remove.mutate(target.id, { onSuccess: () => setOpen(false) })} />

// Bad — ad-hoc spinner + manual disable + relabel; drifts from the standard
<button disabled={save.isPending}>
  {save.isPending ? <span className="animate-spin …" /> : null}
  {save.isPending ? "Saving…" : "Save changes"}
</button>
```

### Styling

Tailwind utility classes with the theme palette (`primary` scale `#004DE7`,
Plus Jakarta Sans). Match neighbouring files' tokens; use `cn()` from
`lib/utils.ts` for conditional classes. No CSS-in-JS, no new style systems, no
raw hex that drifts from the theme.

**The design system is the source of truth for colour — never hardcode a value
that an existing atom/token already owns.** If a colour (or spacing, radius,
shadow, typography) is expressed by a design-system component or token, reuse
that, don't re-type its hex. Map your domain enum to a *semantic* token (a Badge
`tone`, a `primary-*` class), not to literal colours, so a palette change in one
place updates every usage. Re-typing `#C72525` because "danger is red" is the
drift this rule exists to stop.

```tsx
// Good — domain enum -> semantic Badge tone; the Badge atom owns the colours,
// and the selected/idle look is just a Badge variant. Zero hex here.
const PRIORITY_META: Record<Priority, { tone: BadgeTone; shape: Shape }> = {
  Low:    { tone: "info",    shape: "down" },
  Medium: { tone: "warning", shape: "dash" },
  High:   { tone: "danger",  shape: "up" },
}
<Badge tone={meta.tone} variant={selected ? "solid" : "soft"}>{label}</Badge>

// Good — a status badge built from theme tokens via cn()
function StatusBadge({ status }: { status: Status }) {
  return <span className={cn("rounded px-2 py-0.5 text-xs",
    status === "done"   ? "bg-primary-100 text-primary-700"
    : status === "open" ? "bg-gray-100 text-gray-600"
    : "bg-amber-100 text-amber-700")} />
}
// Bad — re-typing colours the Badge already owns, or inline hex off-palette
<span className="text-[#C72525]">High</span>          // use <Badge tone="danger">
<span style={{ color: "#004DE7" }} />                 // use text-primary-600
```

**Encode meaning beyond colour.** ~8% of men are red-green colour-blind, so a
status/priority must also carry a non-colour cue (icon/shape + text label),
never colour alone (WCAG 1.4.1). The priority badges pair each tone with a
distinct shape (▲/▬/▼) and always show the label.


### Imports & files

`@/` alias for everything not co-located; kebab-case filenames; export shared
types next to components. Import icons/utilities from their real source path,
not a barrel re-export, to keep chunks small (perf rule B-1).

```tsx
import { ListTodo } from "lucide-react"               // ok when optimizePackageImports is configured
import { Button, type ButtonProps } from "@/components/atoms/button"
```

### Performance

Don't optimize prematurely: no `memo`/`useCallback` walls without a measured
rerender problem. Do hoist fixed arrays/objects to module-level constants. Heavy
pages are already route-split — keep big libs (charts, editors) inside lazy
pages. The **Performance playbook** below splits this into apply-by-default
correctness rules vs measure-first optimizations.

## Quick reference

| Need | Use |
|---|---|
| Fetch a list | `useQuery({ queryKey: actionItemKeys.list(...), queryFn })` in `hooks/use-x.ts` |
| Create/update/delete | `useMutation` + invalidate `actionItemKeys.all(projectId)` |
| New page | lazy import + route in App.tsx (+ guard wrapper) |
| New nav item | config array in `project-sidebar.tsx` / `sidebar.tsx` |
| Create+edit form | `upsert-x-dialog.tsx` on `FormDrawer` with `initial` |
| Conditional classes | `cn("base", cond && "extra")` |
| Status display | `Badge` atom with tone mapped from status |
| Several fetches at once | parallelise inside `queryFn` with `Promise.all` (W-1) |
| Expensive list filter on typed input | `useDeferredValue` + `useMemo` (M-2) |
| Default object/array prop on a memo'd component | hoist to a module constant (R-5) |

## Common mistakes

- Calling axios/fetch inside a component instead of a hook in `hooks/`.
- Inventing ad-hoc query keys — always extend the factory in `query-keys.ts`.
- Forgetting invalidation after a mutation (stale lists).
- `&&` rendering that can leak `0`; use ternaries (perf rule D-5).
- Defining a child component inside a parent component (perf rule R-1).
- Mirroring server/prop data into state via `useEffect` instead of deriving it (D-2).
- Gating UI on `accountType` and assuming it's secure — it's presentation.
- Separate "create" and "edit" dialogs — one upsert dialog, `initial` prop.
- Hex colors that drift from the theme; check the Tailwind palette first.
- Re-typing a colour/spacing/radius the design system already owns (e.g. a
  Badge tone's hex) instead of reusing the token/component — map enums to
  semantic tokens, never literal values.
- Conveying status/priority by colour alone — add an icon/shape + label (colour-blind safe, WCAG 1.4.1).
- Mutating an array with `.sort()` in a `useMemo` over props — use `.toSorted()` (J-6).
- Hand-rolling a spinner/skeleton or relabelling buttons to "Saving…" — use the `Spinner` atom and the `Button`/`ConfirmDialog` `loading` prop instead.
- Letting a `.tsx`/`.ts` file grow past 400 lines — split sub-components, config
  arrays and shared primitives into their own files before adding more.

---

# Performance playbook

Adapted from Vercel Engineering's React Best Practices, scoped to this codebase.
Each rule has a short ID so reviews and the tables above can point at it. House
rules above already show R-1 (Components) and D-2 (State & data) in full — they
aren't repeated here.

## What applies here, and what doesn't

Client-rendered React Router SPA: pages are `React.lazy`-routed in `App.tsx`,
server state is React Query, HTTP is the axios client, styling is Tailwind.

- **Apply:** re-render correctness, rendering performance, JS hot-path
  micro-optimizations, code-splitting, client data-fetching discipline.
- **Adapt:** the upstream guide's SWR examples map onto React Query (dedup,
  caching, revalidation via the `actionItemKeys` factory); its `next/dynamic`
  maps onto `React.lazy` / dynamic `import()`.
- **Skip (do not introduce):** anything server-side — RSC, SSR, server actions,
  `after()`, `React.cache()`, `next/script`, server resource hints, and
  hydration-mismatch workarounds. There is no server render to optimise. Use
  `React.lazy` and the existing custom `lazy()` in `App.tsx`, not `next/dynamic`.

## Apply by default (correctness + cheap wins)

Not premature optimization — correctness and free wins, so apply everywhere.

**R-1 Never define a component inside a component.** Worked example in the
**Components** rule. A nested definition is a new type each render, so React
remounts it and drops state, DOM and effects (inputs lose focus, scroll resets).

**D-2 Derive during render, don't sync with an effect.** Worked example in
**State & data**.

**D-5 Use ternaries, not `&&`, when the left side can be `0`/`NaN`.**

```tsx
// Bad — renders a literal 0 when there are no open items
{openItems.length && <Badge>{openItems.length}</Badge>}
// Good
{openItems.length > 0 ? <Badge>{openItems.length}</Badge> : null}
```

**J-6 `.toSorted()` over `.sort()` on props/server data** — `.sort()` mutates,
which corrupts the React Query cache array.

```tsx
// Bad — mutates the cached items array in place
const sorted = useMemo(() => items.sort(byDueDate), [items])
// Good — immutable copy
const sorted = useMemo(() => items.toSorted(byDueDate), [items])
```

**R-2 Functional `setState` when the next value depends on the previous one** —
keeps the callback stable and avoids stale closures.

```tsx
const [selected, setSelected] = useState<Set<string>>(new Set())
const toggle = useCallback((id: string) =>
  setSelected(curr => { const next = new Set(curr); next.has(id) ? next.delete(id) : next.add(id); return next }), [])
```

**R-3 Lazy `useState` initializer** for expensive initial values:
`useState(() => buildIndex(items))` — runs once, not every render.

**R-5 Hoist non-primitive default props of memoized components to constants** —
a default `onClick = () => {}` is a fresh reference each render and silently
breaks the `memo`.

```tsx
const NOOP = () => {}
const Row = memo(function Row({ onSelect = NOOP }: { onSelect?: () => void }) { /* ... */ })
```

**R-6 Narrow effect dependencies to primitives** — depend on `item.id`, not the
whole `item`; depend on the derived boolean (`isOverdue`), not the raw date.

**R-7 Don't wrap trivial primitive expressions in `useMemo`** —
`const isLoading = a.isPending || b.isPending` is cheaper than the memo around
it (consistent with the house "no memo walls" stance).

**R-9 Run user-action side effects in the handler, not via state + effect** —
do the POST in `onClick`, don't model "submitted" as state and react in an
effect.

**C-1 Version and guard `localStorage`** — prefix keys (`prefs:v1`), store only
UI fields (never tokens), wrap `getItem`/`setItem` in try/catch (they throw in
private mode / on quota).

**C-2 Passive listeners for scroll/touch/wheel** — `{ passive: true }` on
listeners that never call `preventDefault()`.

**B-1 Import from the real source, not a barrel** — see the **Imports** rule;
applies to `lucide-react`, `@mui/*`, `lodash`, `date-fns`, `@radix-ui/react-*`.

**A-1 App-wide init runs once, not in a component effect** — guard with a
module-level `let didInit` (effects re-run on remount and twice in dev).

## JS hot paths (apply when iterating non-trivial data)

Cheap, only matters at scale. Don't contort small, clear code for these. One
example covering the cluster:

```tsx
// Bad — O(n) find per row, two passes, mutating sort
const rows = items.map(i => ({ ...i, owner: users.find(u => u.id === i.ownerId) }))
const names = items.map(i => i.assignee?.name).filter(Boolean)
// Good — Map for O(1) lookups (J-1/J-2), flatMap maps+filters in one pass (J-3)
const userById = new Map(users.map(u => [u.id, u]))
const rows = items.map(i => ({ ...i, owner: userById.get(i.ownerId) }))
const names = items.flatMap(i => i.assignee ? [i.assignee.name] : [])
```

Also: **J-4** loop for min/max instead of `.sort()[0]`; **J-5** hoist `RegExp`
out of render (module scope, or `useMemo([query])`); **J-7** cache repeated pure
results / storage reads in a module `Map`; **J-8** early-return and early length
checks; **J-9** don't thrash layout — in this repo, toggle a Tailwind class via
`cn()` rather than mutating element styles imperatively.

## Rendering performance (apply when a view is heavy)

- **D-3 `content-visibility: auto` for long scroll lists** — add a Tailwind
  utility `content-visibility: auto; contain-intrinsic-size: 0 <rowHeight>` so
  off-screen rows skip layout/paint. Define it as a class, not inline.
- **D-4 Animate a wrapper `<div>`, not the `<svg>`** — put `animate-spin` /
  transforms on a wrapping div for GPU acceleration.
- **R-7b Hoist static JSX** (a skeleton or large static SVG) to a module
  constant so it isn't recreated each render.
- **D-6 Trim SVG coordinate precision** (`svgo --precision=1`) to shrink inline
  SVG payloads.

## Measure first (reach for these only with an observed problem)

These add indirection/memoization — exactly what the house "no memo walls" rule
warns against. Apply only after the profiler shows jank or excess renders.

**M-2 `useDeferredValue` for an expensive render driven by fast input** — keep
the input snappy, render the heavy result from the deferred value.

```tsx
function ActionItemSearch({ items }: { items: ActionItem[] }) {
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query)
  const results = useMemo(() => items.filter(i => fuzzy(i.title, deferred)), [items, deferred])
  return <>
    <input value={query} onChange={e => setQuery(e.target.value)} />
    <ul style={{ opacity: query !== deferred ? 0.6 : 1 }}>{results.map(r => <ActionItemRow key={r.id} item={r} />)}</ul>
  </>
}
```

Also: **M-1** extract expensive work into a `memo()`'d child so the parent can
early-return before it runs; **M-3** `useTransition`'s `isPending` for
transition-y loading — but for *server* loading use React Query's
`isPending`/`isFetching`, don't wrap queries in transitions; **M-4**
`startTransition` for high-frequency (scroll/resize) state; **M-5** `useRef` for
transient values that shouldn't render (drag offset, mouse position) and write
to the DOM node directly; **M-6** `<Activity mode="hidden">` to preserve an
expensive panel's state across toggles; **M-7** stable callback refs via
`useEffectEvent` so a listener effect doesn't re-subscribe (never put the
`useEffectEvent` result in a deps array).

> If React Compiler is enabled here, the M-* manual memoization and R-5/R-7b
> hoisting become unnecessary — the compiler handles them. The correctness rules
> (R-1, D-2, R-2, J-6, R-9) still apply.

## Code-splitting & data-fetching discipline

- **B-2 Keep heavy libraries inside lazy-routed pages** — charts, rich-text /
  code editors, PDF viewers: import them only within a `React.lazy` page or a
  dynamically-imported child, never from a module on the initial route.
- **B-3 Lazy-load on demand, preload on intent.**

```tsx
const ChartPanel = lazy(() => import("@/components/organisms/chart-panel"))
// warm the chunk on hover/focus so the click feels instant
<button onMouseEnter={() => void import("@/components/organisms/chart-panel")}
        onFocus={() => void import("@/components/organisms/chart-panel")}
        onClick={openChart}>Open chart</button>
```

- **W-1 Parallelise independent fetches** — `Promise.all` inside one `queryFn`,
  and prefer several independent `useQuery`s over a dependent chain.

```ts
queryFn: async () => {
  const [items, members] = await Promise.all([
    api.get(`/projects/${projectId}/action-items`).then(r => r.data),
    api.get(`/projects/${projectId}/members`).then(r => r.data),
  ])
  return { items, members }
}
```

- **W-2 React Query is the dedup layer** — identical keys share one in-flight
  request and one cache entry. Extend the `actionItemKeys` factory instead of
  inventing keys; don't add ad-hoc fetching/caching beside it.