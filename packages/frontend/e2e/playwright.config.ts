import { defineConfig, devices } from "@playwright/test";
import { env } from "./config/env";

// ASSUMPTION (A3): both backend (:3000) and frontend (:5173) must be running
// against a migrated Postgres. Locally Playwright boots `pnpm dev` and reuses an
// already-running server; CI sets E2E_NO_WEBSERVER=1 and provides services.
export default defineConfig({
  testDir: "./specs",
  outputDir: "./.results/artifacts",
  fullyParallel: true,
  forbidOnly: env.isCi,
  retries: env.isCi ? 2 : 0,
  workers: env.isCi ? undefined : "50%",
  timeout: 30_000,
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
      use: { ...devices["Desktop Chrome"], storageState: "./.auth/owner.json" },
    },
    {
      name: "member",
      use: { ...devices["Desktop Chrome"], storageState: "./.auth/member.json" },
    },
    {
      name: "viewer",
      use: { ...devices["Desktop Chrome"], storageState: "./.auth/viewer.json" },
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
