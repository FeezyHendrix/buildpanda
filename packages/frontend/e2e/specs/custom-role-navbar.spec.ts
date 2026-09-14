import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/test";
import { shareProjectWithParticipant } from "../fixtures/seed";
import { closeDb, db } from "../fixtures/db";
import type { ProvisionedUser } from "../fixtures/auth";

const HERE = dirname(fileURLToPath(import.meta.url));

function provisioned(role: string): ProvisionedUser {
  const file = resolve(HERE, "..", ".auth", "users.json");
  const users = JSON.parse(readFileSync(file, "utf-8")) as Record<string, ProvisionedUser>;
  const user = users[role];
  if (!user) throw new Error(`no provisioned user for role ${role}`);
  return user;
}

test.describe("Custom role navbar access @regression @roles", () => {
  test("employee with full COO custom role sees granted project navbar items", async ({ project, roleUser, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner project drives this scenario");

    const member = provisioned("member");
    const roleName = `coo-${Date.now().toString(16)}`;
    const commitmentId = `odc_${Date.now().toString(16)}`;
    let participantId: string | null = null;
    let memberId: string | null = null;

    try {
      await db()("organizationRole").insert({
        id: `role_${Date.now().toString(16)}`,
        organizationId: roleUser.organizationId,
        role: roleName,
        permission: JSON.stringify({
          project: ["view", "create", "update", "delete"],
          finances: ["view", "manage", "approve"],
          schedule: ["view", "manage"],
          materials: ["view", "manage", "report", "request", "approve"],
          documents: ["view", "upload", "delete"],
          rfis: ["view", "create", "respond", "manage"],
          bim: ["view", "upload", "manage"],
          approvals: ["view", "decide"],
          selections: ["view", "decide"],
          queries: ["view", "raise"],
          "change-requests": ["view"],
          "key-dates": ["view"],
          permits: ["view"],
          updates: ["view", "post"],
          messages: ["view", "send"],
          teamMembers: ["view", "manage"],
        }),
      });
      memberId = `mem_${Date.now().toString(16)}`;
      await db()("member").insert({
        id: memberId,
        organizationId: roleUser.organizationId,
        userId: member.userId,
        role: `employee,${roleName}`,
      });
      await db()("member")
        .where({ userId: member.userId, organizationId: member.organizationId })
        .update({ role: "employee" });
      await db()("org_data_commitments")
        .insert({
          id: commitmentId,
          org_id: member.organizationId,
          version: "1.0",
          accepted_by_user_id: member.userId,
          accepted_by_name: member.name,
        })
        .onConflict(["org_id", "version"])
        .ignore();

      participantId = await shareProjectWithParticipant(
        project.id,
        { userId: member.userId, email: member.email },
        roleUser.userId,
        "guest",
      );
      await db()("project_participants")
        .where({ id: participantId })
        .update({ permissions: { "commercial.finances": "hidden", "projects.bim": "hidden" } });

      const context = await browser.newContext({
        storageState: resolve(HERE, "..", ".auth", "member.json"),
        baseURL: "http://localhost:5173",
      });
      try {
        await context.addInitScript((userId) => {
          window.localStorage.setItem(`buildpanda:tour:construction-dashboard:${userId}`, "1");
        }, member.userId);
        const page = await context.newPage();
        await page.goto(`/project/${project.id}/overview`);

        await page.getByRole("button", { name: /^finance$/i }).click();
        await expect(page.locator(`a[href="/project/${project.id}/finances"]`)).toBeVisible();

        await page.getByRole("button", { name: /site control/i }).click();
        await expect(page.getByRole("link", { name: /bim models/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /client approvals/i })).toBeVisible();
      } finally {
        await context.close();
      }
    } finally {
      if (participantId) await db()("project_participants").where({ id: participantId }).delete().catch(() => undefined);
      if (memberId) await db()("member").where({ id: memberId }).delete().catch(() => undefined);
      await db()("member")
        .where({ userId: member.userId, organizationId: member.organizationId })
        .update({ role: "owner" })
        .catch(() => undefined);
      await db()("organizationRole").where({ organizationId: roleUser.organizationId, role: roleName }).delete().catch(() => undefined);
      await db()("org_data_commitments").where({ id: commitmentId }).delete().catch(() => undefined);
      await closeDb().catch(() => undefined);
    }
  });
});
