**Expanded Field Tools release — local gates passed; Railway rollout pending**

The expanded implementation is ready for the existing GitHub-to-Railway CI path: **53 canonical actions, 60 authorized reads**, full schema-based review/rich content/files, material clarification, standalone delays, compound drawing follow-ups and authenticated document artifacts. Both text and completed voice use the same engine. Ordered multipart replies preserve long reviews with native Confirm/Cancel only on the final part and current scope/version/grant fencing on every part.

Final local checks passed **238/238 backend tests, zero failures/skips, 47 entrypoints**, after **224 migrations on a fresh disposable database**; backend/frontend/agent production builds and typechecks; all-53-schema production-browser fixture; and 9/9 configured AI probes (8 synthetic text plus one actual Whisper-to-planner recording). The AI probe did not create construction records or send provider messages. Details: [VERIFICATION.md](VERIFICATION.md).

**This expanded release has not yet been deployed or accepted live on Railway.** Use the existing `master` GitHub integration for the Backend and portal, then verify the release migrations, health, existing-user sign-in, linked Telegram text/voice/media/buttons, exact-once confirmation, revoked access and real storage artifacts. WhatsApp additionally needs its Meta configuration. The fresh-database migration count is not a count of migrations pending in Staging.

Set Backend **`MESSAGING_AGENT_PORTAL_URL=https://panda-agent-staging.up.railway.app`** (or the actual public portal origin) so document receipts open an authenticated exact-revision portal handoff. Preserve the existing API URL, CORS/Better Auth origins, provider secrets, storage and queue/cluster configuration below. Vite's public build arguments do not replace this backend setting. No new deployment hash or successful live conversation is asserted here.

**Historical Staging deployment — earlier daily-log/native-button milestone**

The recorded earlier deployment used GitHub `master` commit `e5689a4ce41ec89983f4b1f892ff1f8d50cbe95f` for the portal and existing backend. At that checkpoint Telegram was enabled with its webhook registered; WhatsApp was disabled because Meta credentials had not been supplied. That historical release covered daily site notes and headers with confirmation, before the expanded Field Tools implementation above.

**Historical deployed services and continuing GitHub workflow**

| Service | Staging URL | Last recorded historical status |
|---|---|---|
| Panda Agent portal | https://panda-agent-staging.up.railway.app | `SUCCESS` on `e5689a4c` |
| Existing Backend | https://api.staging.buildpanda.io | `SUCCESS` on `e5689a4c` |
| Existing BuildPanda app | https://test.buildpanda.io | Existing login/account recovery application |

Both services connect to `FeezyHendrix/buildpanda` on branch `master` through Railway's GitHub integration. New commits to that branch trigger Staging builds; use this existing CI/CD path for future releases. Direct CLI source uploads were abandoned after snapshot-upload timeouts. The new portal has one repository trigger, scoped only to Staging. No portal instance was created in `v2` or production, and existing Backend mappings for `buildpanda-v2`, `prod` and `master` were preserved. Production changes still require the repository's PR workflow into `prod`. [Railway GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys).

Both builds use repository-root source context. Backend uses `packages/backend/Dockerfile`; the portal uses `packages/panda-agent/Dockerfile`. These builds need local shared packages and the shared TypeScript config. The portal also imports the existing frontend atoms/styles. Retain the image start commands; the portal nginx template listens on Railway's runtime `PORT` and serves SPA routes. Healthchecks are Backend `/healthz` and portal `/`. [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [shared monorepos](https://docs.railway.com/deployments/monorepo), [healthchecks](https://docs.railway.com/deployments/healthchecks).

The initial `ab9f3cf6` rollout applied **Batch 62 with the two forward messaging-agent migrations** before serving; the later `e5689a4c` rollout includes the reply-button column migration. Redis queue workers were enabled in only one of the three server processes. The cluster primary assigns the background-worker role; preserve that behavior when changing concurrency.

**Configuration**

The user authorized the existing Staging Backend target and private Railway storage of the supplied bot credential. Credential values are not recorded here. Existing database, authentication, model and object-storage settings were preserved; their presence was checked without printing values.

| Variables | Purpose |
|---|---|
| `NODE_ENV`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Existing backend/database/auth configuration. |
| `REDIS_URL`, `CLUSTER_WORKERS` / `WEB_CONCURRENCY` | Durable queue and server concurrency; the primary assigns `RUN_WORKERS` in clustered mode. |
| `CORS_ORIGIN` | Existing origins plus the exact hosted Panda Agent origin; Better Auth uses the same configured origins. |
| `TELEGRAM_ENABLED=true` | Telegram is enabled in Staging. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_ID`, `TELEGRAM_BOT_USERNAME` | Privately stored bot credential and verified expected identity. |
| `TELEGRAM_WEBHOOK_SECRET` | Independent random secret using 32–256 letters, digits, `_` and `-`. |
| `PUBLIC_API_URL` | Public backend HTTPS origin used by the webhook helper. |
| `MESSAGING_AGENT_PORTAL_URL` | Public Panda Agent portal origin for authenticated exact-revision artifact handoffs; set for the expanded release. |
| `WHATSAPP_ENABLED` | Remains false until complete Meta configuration is supplied. |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_API_VERSION` | Required WhatsApp configuration; keep the Graph API version explicitly pinned. |
| `OPENAI_API_KEY` or `KIMI_API_KEY` | Text planner credentials; OpenAI takes precedence when both are present. |
| `OPENAI_API_KEY` | Also required by the current voice translation helper. |
| `AWS_S3_BUCKET_NAME`, `AWS_DEFAULT_REGION`, `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Object storage for retained original recordings and authorized photo/document/video staging. |

Portal build arguments are `VITE_API_BASE_URL=https://api.staging.buildpanda.io` and `VITE_BUILDPANDA_APP_URL=https://test.buildpanda.io`. Vite embeds these public URLs into browser assets; provider secrets belong only in Backend variables. The production portal calls the API directly and does not depend on Vite's development proxy.

Sign in directly in Panda Agent with an existing BuildPanda email and password. This establishes the session from the portal's own top-level site, which matters because current auth cookies are partitioned. Sign-out clears protected account state and selections before another account loads. Verification and account recovery link to the existing BuildPanda app. A custom domain or DNS change is not required for this flow.

**Historical deployment verification**

The release was prepared in an isolated checkout based on the previous deployed Staging commit, preserving its website changes and excluding unrelated mobile work, local credentials and generated artifacts. The allowlisted patch applied without conflicts and did not alter the primary index. Frozen workspace installation, backend/portal typechecks and production builds passed. All **116 backend gate tests passed with zero skips** after **219 migrations** on a fresh disposable database. The final portal production build also passed the Chromium fixture smoke, including sign-in/out and account isolation.

Live checks after both Railway deployments reached `SUCCESS`:

- Backend `/healthz` returned 200; anonymous protected status returned 401.
- Telegram rejected an invalid webhook secret with 403 before JSON parsing; malformed JSON with the valid secret returned 400; a verified empty update returned 200. These probes contained no message events.
- Telegram identity and registered callback/subscription checks matched, with zero pending updates and no recorded delivery errors.
- Hosted Chromium loaded portal root and nested routes, displayed direct sign-in, and kept protected UI hidden while anonymous. A deliberately nonexistent `.invalid` account returned 401; credentialed CORS allowed the exact portal origin. No JavaScript errors or failed network requests were observed.

These checks establish deployment, webhook registration and anonymous/rejected-login behavior. They do not prove a successful existing-user browser session, a real incoming Telegram text/voice conversation or the quality of live model/speech output. No real account password was provided for a successful-login check. Live WhatsApp remains blocked on Meta credentials and callback subscription.

**Webhook upkeep and remaining live checks**

Telegram callback is `/telegram/webhook`; WhatsApp callback remains `/whatsapp/webhook`. Only private Telegram chats are accepted in this release. A user can link separate channel connections to their authorized project/building through Panda Agent.

The webhook is already registered. For later diagnostics, run the helper from a source checkout; the production Backend image does not contain `scripts/`. `railway run` injects the selected service variables without putting credentials in command arguments. [Railway run](https://docs.railway.com/cli/run).

```sh
railway run --environment Staging --service Backend --no-local pnpm --filter @buildpanda/backend exec tsx scripts/telegram-webhook.ts --check
```

`--check` calls `getMe` and `getWebhookInfo` only and prints safe booleans/counts. It verifies metadata, not an actual incoming message. If intentionally changing the bot or backend callback, first deploy the matching configuration and then use the same helper with `--register`. Registration verifies bot identity, sets the configured secret, subscribes to `message` and `callback_query`, preserves pending updates and checks the resulting callback/subscription. It replaces that bot's existing callback; separate staging/production bots are needed for simultaneous callbacks. [Telegram webhook and identity methods](https://core.telegram.org/bots/api#setwebhook).

After deploying the expanded release, live acceptance is: sign in with an existing authorized user; link Telegram; select project/building; send actual text and voice; review, correct and confirm exactly once; verify denied scope and retained original audio/attribution; sign out and switch accounts. Enable and repeat for WhatsApp after its Meta configuration is supplied. The expanded source must reach Railway through its existing GitHub deployment before these live checks can validate the new behavior.

**Historical formatted-review/native-button release `e5689a4c`**

The formatted-review/native-button release deployed successfully through GitHub `master`. The backend gate passed **143 tests, zero failures/skips across 28 entrypoints**; backend typecheck/production build passed and independent review reported no findings. The release includes `20261116_messaging_agent_reply_buttons.ts` for durable outbox button data. Existing permission, actor/project/building scope, exact proposal/version, stale-review and replay checks remain in force. Presentation preserves original text, paragraphs, dates and quantities.

WhatsApp review buttons use its interactive message format, with a **1,024-character body limit**; plain text remains limited to **4,096 characters**. At that historical release, oversized reviews were blocked without truncating source facts. The expanded release above replaces that behavior with lossless ordered multipart delivery and final-part buttons. WhatsApp remains disabled in Staging pending Meta credentials. Telegram native buttons require both `message` and `callback_query` in the webhook subscription; the updated helper registers and checks both. The deployment owner registered the updated subscription and verified matching bot/webhook metadata, zero pending updates and no recorded delivery errors. Live health returned 200 and the deployed outbox `buttons` column was verified present. No live provider button click or successful real-user conversation is claimed by the automated gate.
