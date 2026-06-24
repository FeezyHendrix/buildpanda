import { test, expect } from "../fixtures/test";
import { shareProjectWithParticipant } from "../fixtures/seed";
import { closeDb } from "../fixtures/db";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
 * RISK MAP — Cross-role authorization (participant = external stakeholder).
 * - Upstream trigger: a project owner invites another person onto their project
 *   as a participant (default role "client", e.g. a homeowner).
 * - Expected guardrail: that participant can SEE the project's data but the app
 *   does NOT offer them mutating actions — participant capabilities are
 *   additive-view only (lib/authorization.ts). Authorization is enforcement, not
 *   presentation: the read works, the write affordances are absent.
 * - Failure liability: if a view-only stakeholder is shown (and can use) create/
 *   edit controls, an outsider can alter the project record — data integrity and
 *   trust breach. This is the brief's "authorization is not presentation" risk.
 */
test.describe("Cross-role participant access @regression @authorization", () => {
  test("a view-only participant sees the project but gets no create action @smoke", async ({
    project,
    roleUser,
    browser,
  }, testInfo) => {
    // Only run from the owner project: it provisions the sharing as the owner and
    // opens a second (viewer) browser context to verify the participant view.
    test.skip(testInfo.project.name !== "owner", "owner project drives this scenario");

    const viewer = provisioned("viewer");

    // Owner shares THIS project with the viewer user as an active "client"
    // participant (direct row insert == accepted invite). Track for teardown.
    let participantId: string | null = null;
    try {
      participantId = await shareProjectWithParticipant(
        project.id,
        { userId: viewer.userId, email: viewer.email },
        roleUser.userId,
        "client",
      );

      // Open a fresh context authenticated as the viewer and load the shared
      // project. The viewer is NOT the owner here — access is purely via the
      // participant row.
      const context = await browser.newContext({ storageState: resolve(HERE, "..", ".auth", "viewer.json") });
      const page = await context.newPage();
      try {
        await page.goto(`/project/${project.id}/action-items`);

        // Guardrail 1: the participant can READ — the page mounts, no error
        // boundary, no access-denied redirect away from the project.
        await expect(page).toHaveURL(new RegExp(`/project/${project.id}/action-items`));
        await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
        await expect(page.getByRole("main")).toBeVisible();

        // Guardrail 2: NO create affordance — "New item" is gated on canManage,
        // which a view-only participant does not have.
        await expect(page.getByRole("button", { name: /new item/i })).toHaveCount(0);
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
