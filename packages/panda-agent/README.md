# Panda Agent

Channel-independent agent review app in the main BuildPanda monorepo. Select a configured messaging app, one of your linked connections, and an authorized project/building. Text and received voice notes enter the same backend proposal, correction and confirmation flow.

WhatsApp and Telegram share the same app and backend workflow; enable each configured adapter independently. The current field-workflow slice supports daily site notes and daily-log headers. The full scope is tracked in [the plan](../../plans/panda-agent/PLAN.md), with backend configuration and verification boundaries in [the implementation notes](../../plans/panda-agent/IMPLEMENTATION.md).

Run from the monorepo root:

```sh
pnpm dev:agent
pnpm --filter @buildpanda/panda-agent typecheck
pnpm build:agent
```

The app runs on port 5175 and proxies `/api` to the existing backend on port 3000. Sign in through the existing BuildPanda app before returning here. `VITE_API_BASE_URL` can select the backend API root; `VITE_BUILDPANDA_APP_URL` selects the existing app, defaulting to `http://localhost:5173`. The backend must allow this app origin when using a separate API origin.

The management API is `/messaging-agent`. Linking includes the selected channel and channel account; disconnect and scope changes target one connection. Queries are isolated by user, channel, account, connection and project. A session response for a different connection is hidden. Records and action permissions remain authoritative in the backend. Missing or denied access blocks protected content and actions.

Only configured channels appear in the selector. A link code remains usable when an adapter has no connection URL: send the displayed `LINK` command in that messaging app. Voice notes are processed after the selected channel delivers the completed recording.

The UI reuses the existing frontend Button, Input, Badge, Spinner and design tokens. It does not maintain another role matrix.

Build the separate production UI image from the repository root:

```sh
docker build -f packages/panda-agent/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.example.test \
  --build-arg VITE_BUILDPANDA_APP_URL=https://app.example.test \
  -t buildpanda-panda-agent .
docker run --rm -e PORT=8080 -p 127.0.0.1:8080:8080 buildpanda-panda-agent
```

Replace the example public origins before deployment. Both variables are required at build time because Vite embeds them in the browser assets. The image serves the SPA through nginx on the runtime `PORT`; it calls the configured backend directly. Add the final agent origin to backend `CORS_ORIGIN` and verify direct sign-in, sign-out and account switching on the deployed portal. [Railway deployment settings and checks](../../plans/panda-agent/RAILWAY.md).

With the app running, execute the real-browser fixture check:

```sh
pnpm --filter @buildpanda/panda-agent test:smoke
```

This drives channel/account/connection selection and isolation, code-only linking, connection-specific disconnect, multi-building selection, versioned corrections and confirmation, HTML preservation, safe failed-message retry, cancellation, receipts, account/project changes, denied/read-only access, unconfigured channels and sign-in. It also checks browser errors. Its second channel is a test fixture, not a shipped provider. The check does not verify real authentication, database persistence or live messaging/voice delivery; backend integration tests cover those separately where stated. Install the Playwright Chromium browser locally if it is not already available.
