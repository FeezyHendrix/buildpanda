# @buildpanda/admin

Platform super-admin panel for BuildPanda staff. A Vite + React + Tailwind v4
SPA that reuses the app's brand (primary `#004DE7`, Plus Jakarta Sans, white
background). Talks to the backend's `/admin/*` API and authenticates with
better-auth.

## Pages

- **Dashboard** — platform-wide counts, budget totals, newest users/projects
- **Users** — list/search, detail, set global admin role, ban/unban, delete
- **Organizations** — list/search, detail (members + projects)
- **Projects** — list/search/filter across all orgs, detail with drill-down
  tabs (finances, inspections, documents, activities, updates, daily logs, risks)

## Develop

```bash
pnpm dev:admin            # http://localhost:5174 (proxies /api -> backend :3000)
# backend must be running:
pnpm dev:backend
```

## Build

```bash
pnpm build:admin          # outputs to packages/admin/dist
```

## Becoming a platform admin

Access is gated by the global `admin` role (better-auth admin plugin).
Bootstrap the first admin without editing the DB:

1. Set `ADMIN_EMAILS` in the backend env (comma-separated), e.g.
   `ADMIN_EMAILS=you@buildpanda.io`.
2. Sign up / sign in with that email. On first authenticated request the
   account is auto-promoted to `admin`.
3. From the Users page, an admin can grant/revoke the admin role for anyone.

`CORS_ORIGIN` must include the admin origin (defaults already include
`http://localhost:5174`). In production set `VITE_API_BASE_URL` to the backend
origin.
