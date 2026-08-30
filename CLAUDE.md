# BuildPanda — Agent Guide

Monorepo (pnpm workspaces). Load the skill for the area you're touching **before**
writing code — the skills hold the real conventions; this file is just the map.

## Skills (source of truth)

| Working in | Load skill |
|---|---|
| `packages/backend` — modules, routes, services, repositories, migrations, auth, config, errors, email, tests | **`writing-backend-code`** |
| `packages/frontend` — pages, components, hooks, React Query, dialogs/forms, routing, styling, performance | **`writing-frontend-code`** |
| `packages/frontend` — React/Next performance: rerenders, bundle size, data fetching, memoization | **`vercel-react-best-practices`** |
| `packages/frontend` — animations, page transitions, gestures, scroll effects, micro-interactions | **`framer-motion-animator`** |

Invoke with the `skill` tool (e.g. `skill(name="writing-backend-code")`). The skills
auto-trigger from their descriptions, but load them explicitly when in doubt — the
cost of loading is near zero, the cost of missing a convention is high.

## Before you build

Construction software is a system of record for a regulated, contractual process.
A feature that looks fine in isolation can be wrong for the methodology. Before
writing code for anything beyond a cosmetic change, work through this and state
the conclusions:

1. **What does this artefact mean on a real project?** A drawing markup, an RFI,
   a valuation, a look-ahead are contractual records with defined lifecycles —
   not UI objects. Model the real-world behaviour, not the screen.
2. **Which existing modules does it touch?** Name them. A comment on a drawing
   reaches RFIs, approvals, tasks, document revisions, participants and
   notifications. Reuse those modules; never fork a parallel concept.
3. **Does it need to survive a refresh, an audit, or a dispute?** If yes it is
   persisted, attributed to an actor, and timestamped — never component state.
4. **Is it revision-scoped?** Anything anchored to a drawing or programme must
   record which revision it was made against, and must not silently carry over
   when that revision is superseded.
5. **Who is allowed to do it?** Check the resource/action the backend enforces;
   viewing a sheet and raising an RFI off it are different permissions.
6. **Would a PM ask Panda AI about it?** If yes, it needs an agent tool (see
   Panda AI awareness below).

If the answer to any of these changes the design, say so **before** implementing.
Shipping a plausible-looking feature that contradicts how the trade actually
works is worse than shipping nothing.

## File size

**400 lines is the hard ceiling for any `.ts`/`.tsx` file** (frontend skill,
"File size"). Backend modules follow the same discipline via their three-layer
split. Check the line count before adding to an existing file: if the change
takes it over, split first — extract sub-components, config arrays and helpers
into siblings — then make the change. Do not append to an already-oversized
file; that is how a page reaches four times the limit one commit at a time.

## Layout

- `packages/backend` — Fastify + Knex modular monolith (one domain per module, three
  layers: routes → service → repository; framework kept out of business logic).
- `packages/frontend` — React Router SPA, React Query, Tailwind, atoms/molecules/organisms.
- `packages/web`, `packages/admin` — secondary apps.

## Commands

- `pnpm dev` — backend + frontend together (`dev:backend`, `dev:frontend` to split).
- `pnpm build` / `build:backend` / `build:frontend`.
- `pnpm db:migrate` / `db:seed` / `db:rollback` (backend Knex).

## Cross-cutting rules

- **Money is logged, not transacted**: BuildPanda is a construction bookkeeping system —
  **money never passes through it**. There is no payment processor, gateway, webhook, escrow
  provider, or bank integration anywhere (verified: no Stripe/Paystack/Flutterwave/Plaid SDK,
  no `PAYMENT_*` config). Every financial action — funding a project, depositing, releasing a
  milestone, recording an invoice/payment/claim — is a **DB record of a real-world money
  movement that happened elsewhere**, not a transaction the system performs. `funds_deposited`,
  `locked_in_escrow`, `remaining_balance` are **tracked figures**; `payment_ledger` and
  `finance_events` are **audit trails**; "escrow" is a computed number, not an account; "Record
  payment" and "Release" **log**, they never charge or move funds. When building finance
  features: model them as append-only logs / recorded figures with an actor + timestamp; never
  imply the system moves money, never add a payment SDK, and treat the record as the source of
  truth for what a human did off-platform. See the finances module (`modules/finances`) as the
  reference: `deposit`/`releaseMilestone` are pure Knex writes.
- **Deployment**: `master` is Railway staging, `prod` is production. Never push directly
  to `prod` — production changes go through a PR into `prod`.
- **Panda AI awareness**: the in-app assistant (`packages/backend/src/modules/panda-ai/agent`)
  can only answer about data its read tools expose. When you add or change project-scoped
  data, ask whether a PM would query Panda AI about it; if so, add an agent tool (query in
  `agent/repository.ts`, tool in `agent/tools.ts`, mention it in the `SYSTEM_PROMPT`). See
  the `writing-backend-code` skill, "Panda AI awareness".
- **Authorization is not presentation**: `accountType` is self-declared; only org membership
  and project participation grant power (backend skill, "Auth").
