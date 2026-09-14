import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiClient } from "./api-client";
import { seedProject, teardownProject, type SeededProject } from "./seed";
import type { ProvisionedUser } from "./auth";

const HERE = dirname(fileURLToPath(import.meta.url));

interface WorkerFixtures {
  // The provisioned user matching the current Playwright project (role).
  roleUser: ProvisionedUser;
  // API client authenticated as the role user, for seeding/teardown.
  api: ApiClient;
  // ONE project per worker, reused by that worker's (serial) tests and torn down
  // at worker end. Worker-scoped (not per-test) because project creation is rate
  // limited; per-worker still gives strict isolation (workers never share state)
  // while keeping the number of POST /projects calls small. Specs name their
  // records with uniqueName(), so serial tests in a worker never collide.
  project: SeededProject;
}

function loadUsers(): Record<string, ProvisionedUser> {
  const file = resolve(HERE, "..", ".auth", "users.json");
  return JSON.parse(readFileSync(file, "utf-8")) as Record<string, ProvisionedUser>;
}

export const test = base.extend<object, WorkerFixtures>({
  roleUser: [
    async ({}, use, workerInfo) => {
      const users = loadUsers();
      const user = users[workerInfo.project.name];
      if (!user) throw new Error(`no provisioned user for project ${workerInfo.project.name}`);
      await use(user);
    },
    { scope: "worker" },
  ],

  api: [
    async ({ roleUser }, use) => {
      const client = new ApiClient();
      client.setCookie(roleUser.cookie);
      await use(client);
    },
    { scope: "worker" },
  ],

  project: [
    async ({ api }, use) => {
      const seeded = await seedProject(api);
      try {
        await use(seeded);
      } finally {
        await teardownProject(api, seeded.id);
      }
    },
    { scope: "worker" },
  ],
});

export { expect };
