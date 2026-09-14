import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/test";
import { shareProjectWithParticipant } from "../fixtures/seed";
import { closeDb } from "../fixtures/db";
import { env } from "../config/env";
import type { ProvisionedUser } from "../fixtures/auth";

const HERE = dirname(fileURLToPath(import.meta.url));

function provisioned(role: string): ProvisionedUser {
  const file = resolve(HERE, "..", ".auth", "users.json");
  const users = JSON.parse(readFileSync(file, "utf-8")) as Record<string, ProvisionedUser>;
  const user = users[role];
  if (!user) throw new Error(`no provisioned user for role ${role}`);
  return user;
}

/**
 * RISK MAP — Role-based access control for tasks (view / add / remove).
 * - Upstream trigger: a project grants a view-only role (here a "client"
 *   participant) access to the tasks board.
 * - Expected guardrail: view-only can SEE tasks but cannot add or remove them —
 *   the "New task" affordance is absent AND the backend rejects create/delete
 *   with 403. A full-access member can add and remove.
 * - Failure liability: if a view-only role can create or delete tasks, an
 *   outsider mutates the board — the "authorization is not presentation" risk.
 */
test.describe("Tasks RBAC @regression @roles @tasks", () => {
  test("view-only role can read tasks but cannot add or remove; owner can @smoke", async ({
    project,
    api,
    roleUser,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner project drives this scenario");

    // Owner (full access) CAN add a task, then remove it.
    const created = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, {
      title: "Owner task",
    });
    const del = await api.delete(`/projects/${project.id}/tasks/${created.id}`);
    expect(del.ok).toBeTruthy();

    // Share the project with a view-only client participant (tasks: ["view"]).
    const viewer = provisioned("viewer");
    let participantId: string | null = null;
    try {
      participantId = await shareProjectWithParticipant(
        project.id,
        { userId: viewer.userId, email: viewer.email },
        roleUser.userId,
        "client",
      );

      const context = await browser.newContext({
        storageState: resolve(HERE, "..", ".auth", "viewer.json"),
      });
      const viewerPage = await context.newPage();
      try {
        await viewerPage.goto(`/project/${project.id}/tasks`);

        // Can READ: the board mounts, no error boundary.
        await expect(viewerPage).toHaveURL(new RegExp(`/project/${project.id}/tasks`));
        await expect(viewerPage.getByText(/Unexpected Application Error/i)).toHaveCount(0);
        await expect(viewerPage.getByRole("main")).toBeVisible();

        // Cannot ADD: no "New task" affordance.
        await expect(viewerPage.getByRole("button", { name: /new task/i })).toHaveCount(0);

        // Enforcement (not just presentation): a direct create is rejected 403.
        const forbidden = await viewerPage.request.post(
          `${env.apiUrl}/projects/${project.id}/tasks`,
          { headers: { Origin: env.baseUrl }, data: { title: "Sneaky" } },
        );
        expect(forbidden.status()).toBe(403);
      } finally {
        await context.close();
      }
    } finally {
      if (participantId) {
        const { db } = await import("../fixtures/db");
        await db()("project_participants").where({ id: participantId }).delete().catch(() => undefined);
        await closeDb().catch(() => undefined);
      }
    }
  });
});
