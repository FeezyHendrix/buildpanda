import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiClient } from "./api-client";
import { seedProject, teardownProject, type SeededProject } from "./seed";
import type { ProvisionedUser } from "./auth";

const HERE = dirname(fileURLToPath(import.meta.url));

interface Fixtures {
  // The provisioned user matching the current Playwright project (role).
  roleUser: ProvisionedUser;
  // An API client authenticated as the role user, for seeding/teardown.
  api: ApiClient;
  // A freshly-seeded project owned by the role user, torn down after the test.
  project: SeededProject;
}

function loadUsers(): Record<string, ProvisionedUser> {
  const file = resolve(HERE, "..", ".auth", "users.json");
  return JSON.parse(readFileSync(file, "utf-8")) as Record<string, ProvisionedUser>;
}

export const test = base.extend<Fixtures>({
  roleUser: async ({}, use, testInfo) => {
    const users = loadUsers();
    const user = users[testInfo.project.name];
    if (!user) throw new Error(`no provisioned user for project ${testInfo.project.name}`);
    await use(user);
  },

  api: async ({ roleUser }, use) => {
    const client = new ApiClient();
    client.setCookie(roleUser.cookie);
    await use(client);
  },

  // Per-test isolation: every spec gets its own project so parallel specs and
  // roles never share mutable state. Teardown runs even if the test failed.
  project: async ({ api }, use) => {
    const seeded = await seedProject(api);
    try {
      await use(seeded);
    } finally {
      await teardownProject(api, seeded.id);
    }
  },
});

export { expect };
