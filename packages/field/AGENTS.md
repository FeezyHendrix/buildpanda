# BuildPanda Field PWA

Follow the [repository RBAC rules](../../AGENTS.md#rbac-is-foundational) and
[frontend conventions](../../.agents/skills/writing-frontend-code/SKILL.md).
This app renders with React DOM. iOS/Android stay in `packages/mobile`.

The capability catalog, policies, SQLite schema/repositories, outbox executors,
and most hooks are shared from `packages/mobile/src`. `vite.config.ts` resolves
browser adapters in this package first, then shared source. Platform dependencies
in shared code must use the existing `@/lib` / `@/db` adapters so the native and
browser typechecks match their runtime. Never add a second role matrix.

Keep protected routes, content, reads and actions denied until scoped access is
known. Offline verification expires after 24 hours. Conversation attachments need
online membership verification. Retain authored originals when a cache copy fails;
await durable copies before discarding staged bytes.

Native runtime imports fail the browser build. The SQLite/WASM data engine is
retained for existing offline databases; its browser bindings do not load Expo's
app runtime or React Native rendering.

Run the typecheck, build, browser suite and production offline suite. Run native
RBAC/voice tests and native typecheck/exports when changing shared source. Use
`tsconfig.check.json` for checking shared source; its dependency type mappings
must not enter Vite's runtime configuration.
