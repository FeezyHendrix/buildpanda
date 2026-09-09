import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env";

// storageState is resolved against the working directory, but global-setup
// writes these files next to this config. Anchoring here keeps the suite
// runnable from packages/frontend (where pnpm e2e starts) and from e2e/.
const HERE = dirname(fileURLToPath(import.meta.url));
const authState = (role: string): string => resolve(HERE, ".auth", `${role}.json`);

// ASSUMPTION (A3): both backend (:3000) and frontend (:5173) must be running
// against a migrated Postgres. Locally Playwright boots `pnpm dev` and reuses an
// already-running server; CI sets E2E_NO_WEBSERVER=1 and provides services.
export default defineConfig({
  testDir: "./specs",
  outputDir: "./.results/artifacts",
  fullyParallel: true,
  forbidOnly: env.isCi,
  // One retry locally too: the dnd-kit tasks board occasionally exceeds its wait
  // late in a long serial run (browser GC pressure), a transient unrelated to
  // correctness. CI keeps 2. Trace/screenshot are captured on the retry only.
  retries: env.isCi ? 2 : 1,
  // Project creation is rate-limited server-side. Locally we run serial (1
  // worker) for deterministic, flake-free signal — the brief prefers truth over
  // breadth. CI fans out with sharding across machines (each with few workers),
  // so no single machine trips the limit. Override with E2E_WORKERS if needed.
  workers: process.env["E2E_WORKERS"]
    ? Number(process.env["E2E_WORKERS"])
    : env.isCi
      ? 2
      : 1,
  // Headroom for the worker-scoped seed to ride out a rate-limit Retry-After.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: env.isCi
    ? [["list"], ["junit", { outputFile: ".results/junit.xml" }], ["blob"]]
    : [["list"], ["html", { open: "never", outputFolder: ".results/html" }]],
  use: {
    baseURL: env.baseUrl,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    testIdAttribute: "data-testid",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  globalSetup: "./global-setup.ts",
  projects: [
    {
      name: "owner",
      use: { ...devices["Desktop Chrome"], storageState: authState("owner") },
    },
    {
      name: "member",
      use: { ...devices["Desktop Chrome"], storageState: authState("member") },
    },
    {
      name: "viewer",
      use: { ...devices["Desktop Chrome"], storageState: authState("viewer") },
    },
  ],
  webServer: env.noWebServer
    ? undefined
    : {
        command: "pnpm --dir ../../.. dev",
        url: env.baseUrl,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
