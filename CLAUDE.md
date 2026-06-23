# BuildPanda — Agent Guide

Monorepo (pnpm workspaces). Load the skill for the area you're touching **before**
writing code — the skills hold the real conventions; this file is just the map.

## Skills (source of truth)

| Working in | Load skill |
|---|---|
| `packages/backend` — modules, routes, services, repositories, migrations, auth, config, errors, email, tests | **`writing-backend-code`** |
| `packages/frontend` — pages, components, hooks, React Query, dialogs/forms, routing, styling, performance | **`writing-frontend-code`** |

Invoke with the `skill` tool (e.g. `skill(name="writing-backend-code")`). The skills
auto-trigger from their descriptions, but load them explicitly when in doubt — the
cost of loading is near zero, the cost of missing a convention is high.

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

- **Deployment**: `master` is Railway staging, `prod` is production. Never push directly
  to `prod` — production changes go through a PR into `prod`.
- **Panda AI awareness**: the in-app assistant (`packages/backend/src/modules/panda-ai/agent`)
  can only answer about data its read tools expose. When you add or change project-scoped
  data, ask whether a PM would query Panda AI about it; if so, add an agent tool (query in
  `agent/repository.ts`, tool in `agent/tools.ts`, mention it in the `SYSTEM_PROMPT`). See
  the `writing-backend-code` skill, "Panda AI awareness".
- **Authorization is not presentation**: `accountType` is self-declared; only org membership
  and project participation grant power (backend skill, "Auth").
