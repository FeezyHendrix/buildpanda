# BuildPanda Field PWA

React + React DOM for Field Tools. The native iOS/Android app remains Expo/React
Native; the desktop React app remains in `packages/frontend`.

The browser has its own screens, navigation and device adapters. Permissions,
record types, repositories, sync/outbox handlers and most hooks reuse the native
app's source. Browser builds reject React Native, Expo UI/router and NativeWind
imports. The existing SQLite/WASM engine, database filenames, migrations, scoped
permission keys and IndexedDB media stores are preserved, including queued work.
There is no database reset or server schema migration for this change.

## Development

Use the workspace install so the SQLite worker patch and shared packages resolve:

```sh
pnpm install --frozen-lockfile
pnpm dev:field
```

The app runs on port 5183. It reads public API configuration from the repository
`.env` and accepts `VITE_API_BASE_URL` or the existing `EXPO_PUBLIC_API_URL`.
For a local backend, use `VITE_API_BASE_URL=http://localhost:3000` and include
`http://localhost:5183` in `CORS_ORIGIN` if your `.env` overrides backend defaults.
`pnpm --filter @buildpanda/mobile web` also starts this React PWA.

## Verification

```sh
pnpm --filter @buildpanda/field typecheck
VITE_API_BASE_URL=https://api.staging.buildpanda.io pnpm build:field
pnpm --filter @buildpanda/field exec playwright install chromium
```

With a dev server using the staging API URL running on 5183, run
`pnpm --filter @buildpanda/field test:browser`. API responses are fixture data;
these tests do not contact a speech model or create real project records.
Recorder controls use simulated microphone input; physical capture remains a
device check.

With the production build served by `PORT=5184 node packages/field/web-server.mjs`,
run `pnpm --filter @buildpanda/field test:offline`. It checks installed-shell reload,
queued RFI persistence, one reconnect write, and expired offline permissions.
Run `pnpm --filter @buildpanda/field test:server` to check the production host.

Shared-source checks: `pnpm --filter @buildpanda/mobile test:rbac`, `test:voice`,
`typecheck`, and Expo exports for iOS, Android and the legacy web target.

## Railway cutover

Keep the existing `mobile-web` service, repository root and custom domain. After
reviewing the change, replace its two existing command variables:

| Variable | Value |
| --- | --- |
| `RAILPACK_BUILD_CMD` | `pnpm --filter @buildpanda/field build` |
| `RAILPACK_START_CMD` | `node packages/field/web-server.mjs` |

Its existing `EXPO_PUBLIC_API_URL=https://api.buildpanda.io` remains supported.
Production builds require a configured API URL. The server uses Railway's `PORT`,
serves compressed static assets and sends the isolation headers needed by SQLite.
The service worker caches the shell/assets; API and authentication responses are
never cached by it. Existing Sentry public configuration remains supported, with
masked replay content and SDK loading deferred until page load.

The 24-hour permission snapshot does not discover revocation while disconnected.
Reconnect verifies access before sync; known denial clears protected downloads
and blocks reads/writes. DM attachments always require online membership checks.
Physical-device Safari, camera and microphone checks remain release checks.
