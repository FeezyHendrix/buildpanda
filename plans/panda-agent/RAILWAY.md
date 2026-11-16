**Panda Agent Railway deployment — prepared 16 November 2026**

WhatsApp and Telegram run together in the existing backend. Enable each adapter independently; the shared inbox, review, daily-log execution and workers serve both. This release covers daily site notes and daily-log headers, with confirmation before writes. It does not establish full Field Tools parity.

**Observed Railway state**

Read-only CLI checks found project **Build Panda**, linked environment **Staging**, and no linked service. The project also has `v2` and `production` environments. Staging's Backend, Postgres, Redis, frontend, Admin and mobile-web latest deployments report `SUCCESS`. The initial service list did not include Panda Agent; the deployment owner has since created the separate `panda-agent` UI service at https://panda-agent-staging.up.railway.app.

The existing Backend already builds `packages/backend/Dockerfile` from the shared repository root. Its Staging deployment is `060ae735-9ced-48af-a814-e6875f71623c`, commit `0875f3f0e061ec0c6e012cdbce28801bfcc98007`; production is a different commit. A successful existing deployment does not include these local adapter changes. Local preparation did not inspect credential values. The deployment owner subsequently verified the supplied bot identity and stored the authorized Telegram credential and an independent webhook secret in Staging Backend variables; deployment and webhook registration remain separate steps.

The user selected the existing **Staging / Backend** service and authorized private Railway storage of the supplied bot credential. The deployment owner handles secret storage and live changes. Use this target for the first live test. Do not deploy the current checkout over production without reviewing its changes against the deployed production commit. Repository policy maps `master` to staging and requires a PR into `prod` for production.

**Backend settings and variables**

Keep the service source root at the repository root. The Dockerfile copies `packages/backend`, `packages/rich-content`, `packages/voice-actions` and the shared TypeScript config. Setting the source root to `packages/backend` removes required build inputs. Select Dockerfile `packages/backend/Dockerfile` in service settings, or use `RAILWAY_DOCKERFILE_PATH=packages/backend/Dockerfile`; retain its production target. [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [shared monorepos](https://docs.railway.com/deployments/monorepo).

Retain the image's start command: `npm run db:migrate && node dist/cluster.js`. It applies forward migrations before serving. Read-only Staging inspection confirmed the existing database has neither messaging-agent tables nor the two new messaging-agent migrations, so the rollout applies those two forward migrations to existing data. The deployment owner configured `/healthz` as Railway's healthcheck; it checks PostgreSQL. The backend listens on Railway's assigned `PORT`. [Railway healthchecks](https://docs.railway.com/deployments/healthchecks).

Set variables in the selected Backend service/environment, keeping secrets out of chat, command arguments and checked-in files:

| Variables | Purpose |
|---|---|
| `NODE_ENV=production`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Existing application/database/auth configuration; preserve working values. |
| `REDIS_URL`, `CLUSTER_WORKERS=1`, `RUN_WORKERS=true` | Durable queue and one initial worker process. When increasing cluster workers later, the primary assigns worker roles automatically. |
| `CORS_ORIGIN` | Include the existing app origins and the final Panda Agent UI origin. Better Auth uses the same configured origins. |
| `TELEGRAM_ENABLED=true` | Enable Telegram alongside WhatsApp. |
| `TELEGRAM_BOT_TOKEN` | User-authorized bot credential, stored privately in the selected Railway service; never include it in source or command arguments. |
| `TELEGRAM_BOT_ID`, `TELEGRAM_BOT_USERNAME` | Expected numeric bot identity and username without `@`; verify against the actual bot before enablement. |
| `TELEGRAM_WEBHOOK_SECRET` | Independent random secret using 32–256 letters, digits, `_` and `-`. |
| `PUBLIC_API_URL` | Public backend HTTPS origin, without a path; used by the registration script. |
| `WHATSAPP_ENABLED=true` | Enable alongside Telegram after all Meta credentials below are configured. Staging currently has no WhatsApp credentials, so WhatsApp remains disabled. |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_API_VERSION` | Existing Meta configuration; API version remains explicitly pinned. |
| `OPENAI_API_KEY` or `KIMI_API_KEY` | Text planner credentials. OpenAI takes precedence when both are present. |
| `OPENAI_API_KEY` | Required by the current voice translation helper, including when Kimi handles text. |
| `AWS_S3_BUCKET_NAME`, `AWS_DEFAULT_REGION`, `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Working object storage for retained original recordings; preserve existing storage settings. |

Telegram callback: `/telegram/webhook`. WhatsApp callback remains `/whatsapp/webhook`, with Meta's message subscription enabled. The same user can link separate channel connections to their authorized project/building through Panda Agent. Only private Telegram chats are accepted in this release.

**Reviewable rollout commands**

The isolated release checkout is `/Users/drhendrix/projects/buildpanda/core-panda-agent-staging`, based on the deployed Staging commit. It preserves Staging website changes and excludes unrelated mobile branch changes. A temporary Git index selected only feature files; the patch applied without conflicts and the primary index remained untouched.

Install from that checkout with a frozen lockfile, including the existing frontend dependency graph because the agent imports its atoms/styles. Then run checks using disposable PostgreSQL/Redis for the integration gate:

```sh
pnpm install --filter @buildpanda/backend... --filter @buildpanda/panda-agent... --filter @buildpanda/frontend... --frozen-lockfile
pnpm --filter @buildpanda/backend exec tsx --test scripts/telegram-webhook.test.ts
pnpm --filter @buildpanda/backend typecheck
pnpm --filter @buildpanda/backend test:messaging-agent
pnpm --filter @buildpanda/backend build
pnpm --filter @buildpanda/panda-agent typecheck
pnpm --filter @buildpanda/panda-agent build
```

After local verification of the isolated release checkout, deploy the user-selected target from that checkout's repository root:

```sh
railway up --environment Staging --service Backend
```

Wait for successful migrations, healthy deployment and active workers. Then use the source checkout for the webhook helper; the production image does not contain `scripts/`. `railway run` injects the selected service variables into this local command; `--no-local` disables development overrides. Neither command prints credential values or API response bodies. [Railway run](https://docs.railway.com/cli/run).

```sh
railway run --environment Staging --service Backend --no-local pnpm --filter @buildpanda/backend exec tsx scripts/telegram-webhook.ts --check
```

`--check` calls `getMe` and `getWebhookInfo` only. It validates bot ID/username and prints safe status booleans and pending-update count. Exit 1 with `webhookMatches=false` is expected before the desired callback is registered. A real incoming message is needed to prove endpoint reachability and verification of the installed webhook secret.

Register only after the new backend is ready:

```sh
railway run --environment Staging --service Backend --no-local pnpm --filter @buildpanda/backend exec tsx scripts/telegram-webhook.ts --register
```

The helper verifies `getMe` before `setWebhook`, sets the configured secret, subscribes only to `message`, preserves pending updates and checks the resulting callback/subscription. Registration replaces that bot's existing callback; use a separate bot for concurrent staging/production tests. Telegram supports one webhook per bot, and a configured webhook disables `getUpdates` polling. [Telegram webhook and identity methods](https://core.telegram.org/bots/api#setwebhook).

Run `--check` again, then perform an authorized live text/voice test on each channel: link the right account, select project/building, review, correct and confirm exactly once. Verify a denied user cannot access or confirm another scope, an invalid Telegram secret is rejected, and WhatsApp still receives/replies. Check retained original audio and daily-log actor/scope attribution. These are release checks; mock provider tests do not prove live credentials, speech quality or delivery.

**UI hosting and remaining blockers**

`packages/panda-agent` also needs a hosted production build. A separate nginx image is prepared at `packages/panda-agent/Dockerfile`, using the existing frontend atoms/styles and local rich-content package. Configure a separate Railway UI service with repository-root source context and Dockerfile `packages/panda-agent/Dockerfile`; retain its image start command and set healthcheck `/`. The nginx template listens on Railway's runtime `PORT` and supports SPA routes.

Set both `VITE_API_BASE_URL` to the public backend HTTPS origin and `VITE_BUILDPANDA_APP_URL` to the existing sign-in app before building the UI. The Dockerfile exposes these as build arguments; Vite embeds them into the static assets. Its development `/api` proxy is absent from production, and this image calls the API directly. These public URLs are the only UI configuration; no bot or provider secret belongs in the UI service.

Prefer a sibling domain such as `agent.buildpanda.io`, add that origin to backend `CORS_ORIGIN` and verify a real signed-in browser session. Current auth cookies are partitioned, so unrelated top-level hosting domains can affect session sharing. The deployment owner created the Staging `panda-agent` service and its Railway domain, with the prepared Dockerfile and public build URLs configured. Backend CORS now includes the exact new Railway UI origin while preserving its existing origins, and Railway healthchecks are configured as backend `/healthz` and UI `/`. A custom domain/DNS change remains optional; verify the login flow on the actual deployed origin before declaring the portal ready.

The UI image built locally on Linux/arm64 with dummy public origins. A real container check passed on a custom `PORT`: root and nested SPA routes, uncached HTML, cached JS/CSS assets, 404 for missing assets, embedded public URLs and `nginx -t`. This does not verify Railway's build architecture, hosting or a real authenticated browser session.

Telegram credential storage is complete. Pending before live completion: remaining service settings verified without exposing values; isolated release checkout validated; hosted agent UI and real login verified; backend rollout and webhook registration; live Telegram text/voice and denied-access checks. Simultaneous live WhatsApp also requires its missing Meta credentials and callback subscription; adapter tests do not establish a live WhatsApp connection.
