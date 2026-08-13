# Frontend Task Assignment — BuildPanda v2

How to pick up, build, and ship frontend work on this repo. Read this before your
first task. It is short, and everything in it is enforced.

---

## 1. Branch workflow — every feature is a PR to `buildpanda-v2`

- Create a **feature branch off `buildpanda-v2`** for every task:
  ```bash
  git fetch origin && git checkout buildpanda-v2 && git pull
  git checkout -b feat/<short-description>
  ```
- Do the work, commit with meaningful messages, push, and open a **pull request
  targeting `buildpanda-v2`**.
- Never push directly to `buildpanda-v2`, `master`, or `prod`.
  - `master` = Railway staging.
  - `prod` = production. Production changes go through a PR into `prod` (rare, senior-only).
- Keep PRs focused: one feature or one bug per PR. Small diffs review faster and
  conflict less. Update the PR description with what changed and what to QA.

---

## 2. Getting started

```bash
pnpm install                    # monorepo (pnpm workspaces)
pnpm dev                        # backend + frontend together
pnpm dev:frontend               # frontend only (Vite, port 5173)
pnpm build                      # typecheck + build everything
pnpm build:frontend             # frontend only
pnpm lint                       # ESLint
```

Frontend package scripts (`packages/frontend/package.json`):
- `pnpm build` — runs `tsc -b && vite build` (typecheck is part of the build, don't skip it)
- `pnpm lint` — `eslint .`
- `pnpm e2e:smoke` — Playwright smoke tests (`@smoke` tag)

**Before you open a PR, run `pnpm build:frontend` and `pnpm lint`.** A PR that
doesn't compile or cleanly type-check is returned.

---

## 3. Where things live (`packages/frontend/src`)

| Path | What lives here |
|---|---|
| `src/api/` | One file per domain (`projects.ts`, `finances.ts`, …). Thin axios clients. |
| `src/hooks/` | React Query hooks (`use-projects.ts`, `use-finances.ts`, …). Map 1:1 to `api/`. |
| `src/components/atoms/` | Small primitives (buttons, inputs, badges). |
| `src/components/molecules/` | Composed pieces (modals, cards, switchers, forms). |
| `src/components/organisms/` | Large sections / page blocks. |
| `src/pages/` | Route-level screens (`dashboard/`, `project/`, `onboarding/`, `auth/`, …). |
| `src/assets/icons/` | Legacy icon folder. **Do not add new icons here.** |
| `src/assets/icons2/` | **New icons go here. See §4.** |
| `src/styles/index.css` | **All design tokens and styling. See §5.** |

Use the `@/` alias (maps to `./src`):
```ts
import { icons2 } from "@/assets/icons2/icon2";
```

**Component naming:** files are `kebab-case.tsx`. Match the folder's existing
conventions before writing anything new.

---

## 4. Icons — export from Figma into `icons2`, register in `icon2.ts`

When a task needs an icon that is not already in the project:

1. Export the SVG from Figma **as a plain SVG file** (not a component).
2. Drop it into `packages/frontend/src/assets/icons2/` using the naming convention
   **`<name>.icon.svg`** (e.g. `crane.icon.svg`, `money-bag.icon.svg`).
3. **Register it in `packages/frontend/src/assets/icons2/icon2.ts`** — the file
   that exports the `icons2` map. Add an import line plus a camelCase entry:
   ```ts
   import MoneyBagIcon from '@/assets/icons2/money-bag.icon.svg';

   export const icons2 = {
     // ...
     moneyBag: MoneyBagIcon,
   };
   ```
4. Use it in components. Icons are **URL assets** (not components), so render them
   with `ReactSVG` (default) or `img`:
   ```tsx
   import { ReactSVG } from 'react-svg'
   import { icons2 } from '@/assets/icons2/icon2'

   <ReactSVG src={icons2.moneyBag} />
   <ReactSVG src={icons2.plus} className="[&_svg]:size-[14px] [&_path]:fill-white shrink-0" />
   ```
   `ReactSVG` lets you restyle the inner `path`s via arbitrary Tailwind selectors;
   `img` cannot.

Rules:
- **Never** import SVG files directly by path in a component — always from `icon2.ts`.
- **Never** add new icons to `src/assets/icons/` (legacy) — only `icons2/`.
- Prefer reusing an existing `icons2` entry over adding a near-duplicate.
- kebab-case file name + camelCase map key. Keep the map alphabetized.

---

## 5. Styling — everything lives in `index.css`, not inline

`packages/frontend/src/styles/index.css` is the **single source of truth** for all
typography and color. It is a Tailwind v4 `@theme` token file.

### Typography (font size / line height / letter spacing are decided here)

Do **not** hand-write `text-[13px]`, `leading-[18px]`, or `tracking-[…]`. The tokens
already bundle size + line-height + letter-spacing (-2%) into one utility.

| Token classes | Notes |
|---|---|
| `text-h1` … `text-h6` | Headings, Archivo. |
| `text-body-l` / `text-body-m` / `text-body-s` | Body, Inter. |
| `text-caption-l` / `text-caption-m` / `text-caption-s` | Captions/labels, Inter. |

Pair each with a weight utility: `font-light | font-normal | font-medium | font-semibold | font-bold`.

```tsx
<h2 className="text-h3 font-bold">Project overview</h2>
<p className="text-body-m font-normal text-grey-400">…</p>
<span className="text-caption-m font-medium text-primary-500">Label</span>
```

If a token doesn't exist for what the design needs, **add a token to `index.css`** —
do not invent one-off values in components.

### Colors

Use the tokens defined in `index.css` (all available as Tailwind utilities):

- `primary-50 … primary-900`, plus `brand` (= `primary-500`, BuildPanda blue) and `primary-dark`.
- `secondary` = brand yellow, `success-50…900`, `error-50…900`, `warning-50…900`.
- `black-50…900` (ink/text), `grey-50…900` (neutrals).
- shadcn semantic vars (`bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`,
  `border`, `text-muted-foreground`, …) for component-library primitives.

Dark mode is `.dark` on `<html>` and switches the semantic shadcn vars — test new UI
in both light and dark.

### Other rules in `index.css`

- All pre-defined keyframes/animations live there (`pop`, `fade-in`, `slide-up`,
  `search-slide-*`, `fab-*`, `emoji-pop`). Reuse those rather than defining new ones.
- Respect `prefers-reduced-motion` (already handled globally).
- Don't remove the desktop density rule (`html { font-size: 90% }` at ≥768px + fine
  pointer) — popup positioning depends on it.
- Index.css is imported once in `src/main.tsx`. Don't duplicate its tokens elsewhere.

---

## 6. Skills installed — use them, they make you faster

Skills are loaded by the agent through the `skill` tool when doing the matching task.
Each holds the real conventions; trust them over this doc when they disagree.

| Skill | Load it when |
|---|---|
| `writing-frontend-code` | Writing/extending frontend pages, components, hooks, dialogs, routing. House conventions. |
| `vercel-react-best-practices` | React/Next performance: rerenders, bundle size, data fetching, memoization. |
| `tailwind-design-system` | Building scalable design systems, tokens, component libraries, responsive patterns. |
| `frontend-design` | Building new UI or reshaping existing UI — aesthetic direction, typography, distinctive visual choices. |
| `screenshot-to-code` | Converting a screenshot/dribbble-style mockup into working code. |
| `framer-motion-animator` | Micro-interactions, page transitions, gestures, scroll effects. |
| `writing-backend-code` | Only if you touch `packages/backend` (rare for a frontend task). |
| `browser-automation` | Verifying your page actually renders (console errors, screenshots). |

**When in doubt, load the skill before writing code.** The cost is near zero; the
cost of missing a convention (typo tokens, wrong data-fetching pattern, icon in the
wrong folder) is a rejected PR.

---

## 7. Frontend data conventions (React Query)

- All server data goes through **React Query**. One hook file per domain in
  `src/hooks/`, backing `api/` methods in `src/api/`.
- Query keys are centralized in `src/hooks/query-keys.ts` — reuse them; don't scatter
  inline key strings.
- Mutations use `queryClient.invalidateQueries(...)` after success so lists refresh.
- Load-manage: loading skeletons/empty states for every async view.

---

## 8. Definition of Done — check before opening a PR

- [ ] Branch is `feat/…` cut from `buildpanda-v2`.
- [ ] No build/type errors: `pnpm build:frontend` passes.
- [ ] `pnpm lint` is clean.
- [ ] New icons are in `src/assets/icons2/` **and** registered in `icon2.ts`.
- [ ] No new `text-[…px]`, `leading-[…]`, `tracking-[…]` one-offs — design tokens used.
- [ ] No new icons in `src/assets/icons/`.
- [ ] Tested in light + dark mode (if the UI has surfaces affected by the theme).
- [ ] Smoke: `pnpm e2e:smoke` still passes if your change touches critical flows.
- [ ] PR opened against `buildpanda-v2` with a short description.

---

## 9. Things you should know

- **Money is logged, not transacted.** This is a construction bookkeeping system —
  money never passes through it. No payment SDK exists. Every financial view
  (escrow, balances, milestones, invoices) is a **record** of a real-world movement
  that happened off-platform. Model new finance UI as recorded figures — never imply
  the system charges or moves funds. See the finances module as the reference.
- **`icon2.ts` naming**: the icons map file is named `icon2.ts` (singular) but the
  export and the folder are `icons2`. You'll see `import { icons2 } from
  "@/assets/icons2/icon2"` — that's the current convention.
- **Font source-of-truth is a known mismatch**: `index.html` loads *Plus Jakarta
  Sans* from Google Fonts, while `index.css` tokens declare *Inter* + *Archivo*.
  Follow the `index.css` tokens (Inter body / Archivo headings) — the HTML link will
  be reconciled eventually. If you touch typography, flag it in the PR.
- **Authorization is not presentation.** `accountType` is self-declared; only org
  membership and project participation grant power. Hide/show UI by real
  project-participation data, not by what the user claims to be.
- **Don't commit to `master`/`prod`.** All frontend work lands via `buildpanda-v2`.

---