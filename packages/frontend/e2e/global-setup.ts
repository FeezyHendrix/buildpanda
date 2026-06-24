import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { provisionUser, type ProvisionedUser } from "./fixtures/auth";
import { closeDb } from "./fixtures/db";
import { env } from "./config/env";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROLES = ["owner", "member", "viewer"] as const;
const AUTH_DIR = resolve(HERE, ".auth");

// ASSUMPTION (A1): no pre-seeded authenticatable tenant — we self-provision one
// user per role (sign-up → verify via DB → sign-in), then convert the API
// session cookie into a Playwright storageState so each role project starts
// already logged in with strict session isolation.
export default async function globalSetup(_config: FullConfig): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const provisioned: Record<string, ProvisionedUser> = {};

  try {
    for (const role of ROLES) {
      const user = await provisionUser(role);
      provisioned[role] = user;
      await writeStorageState(role, user);
    }
    // Record the provisioned identities so specs/global-teardown can reach the
    // same accounts (e.g. to seed via the API as that exact user).
    writeFileSync(
      resolve(AUTH_DIR, "users.json"),
      JSON.stringify(provisioned, null, 2),
    );
  } finally {
    await closeDb();
  }
}

// Drive a real browser sign-in once to capture the cookie in Playwright's
// storageState format. We reuse the already-verified credentials; the UI login
// is the most faithful way to produce a storageState the SPA accepts.
async function writeStorageState(role: string, user: ProvisionedUser): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: env.baseUrl });
    const page = await context.newPage();
    await page.goto("/auth/sign-in");
    await page.getByRole("textbox", { name: /email/i }).fill(user.email);
    // TESTID-NEEDED: password inputs have no ARIA textbox role; the only stable
    // hook is the input type. A data-testid="password" would let us use a role.
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 20_000 });
    const file = resolve(AUTH_DIR, `${role}.json`);
    mkdirSync(dirname(file), { recursive: true });
    await context.storageState({ path: file });
  } finally {
    await browser.close();
  }
}
