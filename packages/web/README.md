# @buildpanda/web

The BuildPanda marketing website for **buildpanda.io**.

SEO-optimised site built with Next.js (App Router), Tailwind CSS v4 and Plus
Jakarta Sans, matching the BuildPanda app's brand (primary `#004DE7`, white
background). Runs as a Node server (`next start`).

## Pages

- `/` — Home
- `/product` — The construction management software
- `/construction` — The managed construction service
- `/about` — About us and contact

## Develop

```bash
pnpm --filter @buildpanda/web dev      # http://localhost:3001
```

## Build & run (server)

```bash
pnpm --filter @buildpanda/web build    # production build to packages/web/.next
pnpm --filter @buildpanda/web start    # next start on http://localhost:3001
```

## Configuration

- `NEXT_PUBLIC_LEADS_ENDPOINT` — where the consultation form POSTs leads (JSON).
  Copy `.env.example` to `.env.local` and set it. When unset, submissions are
  logged to the console so nothing breaks in development.
- Update contact details (`email`, `phones`, `appUrl`) in `lib/site.ts`.

## SEO

- Per-page `title`, `description`, canonical, OpenGraph and Twitter metadata.
- JSON-LD: `Organization` (global), `SoftwareApplication` (product),
  `Service` (construction).
- `sitemap.xml` and `robots.txt` generated at build time.
