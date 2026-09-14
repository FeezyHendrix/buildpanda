import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/test";
import { closeDb, db } from "../fixtures/db";
import { shareProjectWithParticipant } from "../fixtures/seed";
import type { ProvisionedUser } from "../fixtures/auth";

const HERE = dirname(fileURLToPath(import.meta.url));

function provisioned(role: string): ProvisionedUser {
  const file = resolve(HERE, "..", ".auth", "users.json");
  const users = JSON.parse(readFileSync(file, "utf-8")) as Record<string, ProvisionedUser>;
  const user = users[role];
  if (!user) throw new Error(`no provisioned user for role ${role}`);
  return user;
}

test.describe("Queries RBAC @regression @queries @roles", () => {
  test("client with query edit access can edit without participant-list permission toast", async ({
    project,
    api,
    roleUser,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner project drives this scenario");

    const client = provisioned("viewer");
    let participantId: string | null = null;
    try {
      participantId = await shareProjectWithParticipant(
        project.id,
        { userId: client.userId, email: client.email },
        roleUser.userId,
        "client",
      );
      await db()("project_participants")
        .where({ id: participantId })
        .update({ permissions: { "workflow.queries": "edit" } });

      const query = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/queries`, {
        subject: "Client editable query",
        question: "Can a client edit this?",
      });

      const context = await browser.newContext({
        storageState: resolve(HERE, "..", ".auth", "viewer.json"),
        baseURL: "http://localhost:5173",
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        await page.goto(`/project/${project.id}/queries`);

        await expect(page.getByText("Client editable query")).toBeVisible();
        await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /^delete$/i })).toHaveCount(0);
        await expect(page.getByText(/you do not have permission/i)).toHaveCount(0);
        expect(errors.some((line) => line.includes("/participants") && line.includes("403"))).toBe(false);

        const update = await page.request.patch(`http://localhost:3000/projects/${project.id}/queries/${query.id}`, {
          headers: { Origin: "http://localhost:5173" },
          data: { status: "Answered", answer: "Yes" },
        });
        expect(update.status()).toBe(200);
      } finally {
        await context.close();
      }
    } finally {
      if (participantId) await db()("project_participants").where({ id: participantId }).delete().catch(() => undefined);
      await closeDb().catch(() => undefined);
    }
  });
});
