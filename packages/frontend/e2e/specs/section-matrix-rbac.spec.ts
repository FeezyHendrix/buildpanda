import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/test";
import { ApiClient } from "../fixtures/api-client";
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

test.describe("Section-matrix RBAC parity @regression @roles @rbac", () => {
  test("participant granted schedule via the section matrix can manage activities over HTTP (no 403)", async ({
    project,
    roleUser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner worker seeds the project + participant");

    const participant = provisioned("viewer");
    let participantRowId: string | null = null;
    try {
      participantRowId = await shareProjectWithParticipant(
        project.id,
        { userId: participant.userId, email: participant.email },
        roleUser.userId,
        "client",
      );
      await db()("project_participants")
        .where({ id: participantRowId })
        .update({ permissions: { "projects.schedule": "edit" } });

      const participantApi = new ApiClient();
      participantApi.setCookie(participant.cookie);

      const created = await participantApi.post<{ id: string }>(`/projects/${project.id}/activities`, {
        name: "Matrix-granted activity",
        activityType: "Task",
        plannedStartAt: "2026-01-01",
        plannedEndAt: "2026-01-10",
      });

      expect(created.status, JSON.stringify(created.body)).not.toBe(403);
      expect(created.status).toBe(201);
      expect(created.body.id).toBeTruthy();

      const listed = await participantApi.get<Array<{ id: string }>>(`/projects/${project.id}/activities`);
      expect(listed.status).toBe(200);

      if (created.body.id) {
        await participantApi.delete(`/projects/${project.id}/activities/${created.body.id}`);
      }
    } finally {
      if (participantRowId) {
        await db()("project_participants").where({ id: participantRowId }).delete().catch(() => undefined);
      }
      await closeDb().catch(() => undefined);
    }
  });

  test("participant WITHOUT the finances matrix cannot manage budget (403)", async ({
    project,
    roleUser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner worker seeds the project + participant");

    const participant = provisioned("viewer");
    let participantRowId: string | null = null;
    try {
      participantRowId = await shareProjectWithParticipant(
        project.id,
        { userId: participant.userId, email: participant.email },
        roleUser.userId,
        "client",
      );
      await db()("project_participants")
        .where({ id: participantRowId })
        .update({ permissions: { "commercial.budget": "edit" } });

      const participantApi = new ApiClient();
      participantApi.setCookie(participant.cookie);

      const created = await participantApi.post(`/projects/${project.id}/budget/categories`, {
        name: "Should be blocked",
      });

      expect(created.status).toBe(403);
    } finally {
      if (participantRowId) {
        await db()("project_participants").where({ id: participantRowId }).delete().catch(() => undefined);
      }
      await closeDb().catch(() => undefined);
    }
  });
});
