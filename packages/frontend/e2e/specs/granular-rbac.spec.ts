import { test, expect } from "../fixtures/test";
import { ApiClient } from "../fixtures/api-client";
import { closeDb, db } from "../fixtures/db";
import { shareProjectWithParticipant } from "../fixtures/seed";
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

test.describe("Granular RBAC conversion @regression @rbac @roles", () => {
  test("owner passes every newly-granular guard (resource:action strings are valid)", async ({
    project,
    api,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner worker only");

    const stage = await api.post(`/projects/${project.id}/stages`, { name: "Foundations" });
    expect(stage.status, JSON.stringify(stage.body)).toBe(201);

    const changeRequest = await api.post(`/projects/${project.id}/change-requests`, {
      title: "Extra window",
      description: "Add a window to unit 3",
    });
    expect([200, 201]).toContain(changeRequest.status);

    const actionItem = await api.post(`/projects/${project.id}/action-items`, {
      title: "Order rebar",
    });
    expect([200, 201]).toContain(actionItem.status);

    const risk = await api.post(`/projects/${project.id}/risk-factors`, {
      title: "Rain delay",
      description: "Heavy rain may delay the pour",
      severity: "High",
    });
    expect([200, 201]).toContain(risk.status);

    const selection = await api.post(`/projects/${project.id}/selections`, {
      title: "Tile choice",
    });
    expect([200, 201]).toContain(selection.status);

    const approval = await api.post(`/projects/${project.id}/approvals`, {
      title: "Approve slab pour",
    });
    expect([200, 201]).toContain(approval.status);

    for (const path of [
      `/projects/${project.id}/stages`,
      `/projects/${project.id}/change-requests`,
      `/projects/${project.id}/action-items`,
      `/projects/${project.id}/risk-factors`,
      `/projects/${project.id}/daily-logs`,
      `/projects/${project.id}/weather/current`,
      `/projects/${project.id}/reporting/snapshot`,
    ]) {
      const res = await api.get(path);
      expect(res.status, `GET ${path} -> ${res.status}`).not.toBe(403);
      expect(res.status, `GET ${path} -> ${res.status}`).toBeLessThan(500);
    }
  });

  test("read-only client participant is blocked from manage-gated writes (403)", async ({
    project,
    roleUser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner worker seeds participant");

    const client = provisioned("viewer");
    let participantRowId: string | null = null;
    try {
      participantRowId = await shareProjectWithParticipant(
        project.id,
        { userId: client.userId, email: client.email },
        roleUser.userId,
        "client",
      );

      const clientApi = new ApiClient();
      clientApi.setCookie(client.cookie);

      const stage = await clientApi.post(`/projects/${project.id}/stages`, { name: "Nope" });
      expect(stage.status).toBe(403);

      const changeRequest = await clientApi.post(`/projects/${project.id}/change-requests`, {
        title: "Nope",
        description: "blocked",
      });
      expect(changeRequest.status).toBe(403);

      const readStages = await clientApi.get(`/projects/${project.id}/stages`);
      expect(readStages.status).not.toBe(403);
    } finally {
      if (participantRowId) {
        await db()("project_participants").where({ id: participantRowId }).delete().catch(() => undefined);
      }
      await closeDb().catch(() => undefined);
    }
  });
});
