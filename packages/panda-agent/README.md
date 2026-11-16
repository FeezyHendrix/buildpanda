# Panda Agent

Channel-independent Field Tools app in the main BuildPanda monorepo. WhatsApp and Telegram share the existing backend's planner, review, canonical execution and durable inbox/outbox. Link a configured channel/account, then select an authorized workspace, project and, where required, building. Text and completed voice notes use the same correction and confirmation flow.

The backend exposes **53 canonical action kinds**: all 52 shared mobile kinds plus standalone activity delay, and **60 authorized read tools**. This includes daily logs/templates, materials/orders/deliveries/approvals, expenses, tasks, RFIs, changes, look-aheads, activity/stage progress, messages, updates, documents/revisions and drawing markups. Models, request schemas, effective permissions and domain services remain authoritative. See [implementation scope](../../plans/panda-agent/IMPLEMENTATION.md) and [verification evidence](../../plans/panda-agent/VERIFICATION.md).

The expanded release passed **238 backend tests with zero failures/skips across 47 entrypoints**, production builds/typechecks, and the production-browser fixture covering all 53 schemas. A separate configured AI probe passed 8 synthetic text cases plus one actual Whisper-to-planner voice case, without construction-record writes or provider sends. Deploy this release through the existing GitHub/Railway CI path; verify the deployed commit and health after rollout. Earlier Staging deployment evidence is historical; see [Railway status and live checks](../../plans/panda-agent/RAILWAY.md).

Reviews use the canonical schema to render nested objects/arrays, numbers, booleans, choices, dates, templates, assignee types, rich HTML/plain-text mirrors and explicit file pickers. Unknown fields or missing facts block confirmation and produce a clarification. A tanker/sand delivery needs its actual material, quantity and unit; the agent does not invent those facts. Drawing geometry requires an explicit document revision/page/position; optional RFI/material-approval follow-ups link the actual new pin.

Native **Confirm** and **Cancel** buttons carry the exact proposal/version. Long reviews are split into ordered messages without truncating facts; only the final part carries buttons, and an earlier failed/uncertain part prevents later confirmation delivery. Each part, replay and history read rechecks current access and scope. Confirmation commits canonical writes and action receipts together; repeats return the stored result.

Photos/documents/videos and captions can enter through either adapter or app multipart upload. The backend authorizes canonical staging before fetching bytes, retains originals for retry and offers only authorized file IDs. Voice processing begins after the provider delivers the completed recording; original audio and the speech helper's English translation are distinguished. Real camera/microphone behavior, native offline sync, home customization and viewer gestures/calibration remain device or authenticated BuildPanda workflows.

Document open/download results provide an authenticated exact-revision artifact link. The app fetches actual bytes with the session, previews PDF/raster types and downloads a local blob; HTML/SVG/XML are not embedded. Links require sign-in and current access. A readiness receipt does not claim that a messaging provider delivered a file or that the user downloaded it.

Run from the monorepo root:

```sh
pnpm dev:agent
pnpm --filter @buildpanda/panda-agent typecheck
pnpm build:agent
```

The app runs on port 5175 and proxies `/api` to the existing backend on port 3000. Sign in directly with an existing BuildPanda email/password. Sign-out clears protected account state before another account can load; verification/recovery link to the existing app. `VITE_API_BASE_URL` selects the API root; `VITE_BUILDPANDA_APP_URL` selects the existing app (locally `http://localhost:5173`). Separate hosted API origins must allow the portal in backend CORS/Better Auth. Set backend `MESSAGING_AGENT_PORTAL_URL` to the public portal origin for authenticated artifact handoffs.

The management API is `/messaging-agent`. Linking, disconnect and scope changes target one channel/account/connection. Queries and history are isolated by user, workspace, connection and project. Missing/denied access blocks protected content/actions; the UI uses server capabilities rather than another role matrix. Only configured channels appear; when no connect URL exists, send the displayed `LINK` command in that messaging app. Telegram webhooks subscribe to both `message` and `callback_query`; only private/direct provider ingress is enabled.

The UI reuses the frontend atoms/design tokens and the shared rich-text editor. Build its separate production image from repository-root context:

```sh
docker build -f packages/panda-agent/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.example.test \
  --build-arg VITE_BUILDPANDA_APP_URL=https://app.example.test \
  -t buildpanda-panda-agent .
docker run --rm -e PORT=8080 -p 127.0.0.1:8080:8080 buildpanda-panda-agent
```

Replace example public origins before deploying. Vite embeds both public build arguments; provider secrets belong only in Backend variables. nginx serves the SPA on runtime `PORT`. The portal calls the configured API directly.

With the production app running, execute the real-browser fixture check:

```sh
pnpm --filter @buildpanda/panda-agent test:smoke
```

The fixture checks all 53 schemas, typed/rich nested corrections, uploads/attachment ingress, actual authenticated fixture PDF bytes/preview/download, unsafe-MIME blocking, sign-in/handoff/revocation, material clarification, daily headers, retries/cancellation and account/project/channel isolation, with no browser errors. This is fixture transport and session behavior; it does not establish hosted real-user login, live Telegram/WhatsApp text/voice/media/button delivery, or production-storage downloads. Install Playwright Chromium locally if needed. Remaining rollout checks are in [the Railway runbook](../../plans/panda-agent/RAILWAY.md).
