# @buildpanda/web

The BuildPanda marketing website for **buildpanda.io**.

SEO-optimised site built with Next.js (App Router), Tailwind CSS v4 and Plus
Jakarta Sans, matching the BuildPanda app's brand (primary `#004DE7`, white
background). Runs as a Node server (`next start`).

## Pages

- `/` — Construction management software overview
- `/for-contractors/` — Software for contractors
- `/for-owners/` — Software for owners and developers
- `/construction/` — Managed construction service
- `/about/` — About us and contact
- `/talk-to-us/` — Software demos and construction consultations
- `/privacy/`, `/data-policy/`, `/terms-of-service/` — Legal policies

## Develop

```bash
pnpm --filter @buildpanda/web dev      # http://localhost:3001
```

Run one Next.js process per working copy. Development servers and production
builds share `.next`; use a separate working copy for concurrent validation to
avoid serving mismatched bundles.

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
- Marketing copy and service metadata do not restrict the site to a country.
  Contact details and legal jurisdiction remain factual; project screenshots
  retain the locations and currencies shown in those examples.
- JSON-LD: `Organization` and `WebSite` (global), `SoftwareApplication` and
  `FAQPage` (home), `Service` (construction), and breadcrumbs (inner pages).
  FAQ markup uses the same content as the visible answers; it does not
  guarantee a search rich result.
- `sitemap.xml` and `robots.txt` generated at build time. Canonical and sitemap
  page URLs use trailing slashes to match the routes. The sitemap omits
  `lastModified` until reliable per-page content update dates are available.
- Product screenshots use Next.js image optimization and responsive `sizes`;
  SVG logos are served directly. Keep the image optimizer available when
  deploying the Node server.
