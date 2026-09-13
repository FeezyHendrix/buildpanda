import { test } from "node:test";
import assert from "node:assert/strict";
import { lookAheadsService } from "./service.ts";
import type { LookAheadsRepository } from "./repository.ts";
import type { LookAheadRow, LookAheadStatus } from "./types.ts";

function row(status: LookAheadStatus): LookAheadRow {
  return {
    id: "la_1",
    project_id: "prj_1",
    building_id: "bld_1",
    name: "Weeks 2-3",
    description: null,
    status,
    start_date: "2026-09-14",
    end_date: "2026-09-27",
    total_workers: 22,
    created_by_id: "usr_1",
    approved_by_id: null,
    approved_by_name: null,
    approved_at: null,
    approval_note: null,
    created_at: "2026-09-13T08:00:00.000Z",
    updated_at: "2026-09-13T08:00:00.000Z",
  };
}

function fakeRepo(current: LookAheadRow): {
  repo: LookAheadsRepository;
  patches: Record<string, unknown>[];
} {
  const patches: Record<string, unknown>[] = [];
  const repo = {
    findById: async () => current,
    update: async (_id: string, patch: Record<string, unknown>) => {
      patches.push(patch);
      return { ...current, ...patch } as LookAheadRow;
    },
    activitiesFor: async () => [],
  } as unknown as LookAheadsRepository;
  return { repo, patches };
}

const noBuilding = async (): Promise<string | undefined> => undefined;

test("approve stamps the approver and the time", async () => {
  const { repo, patches } = fakeRepo(row("Draft"));
  const service = lookAheadsService(repo, noBuilding);

  const approved = await service.approve("prj_1", "la_1", { note: " Subject to TMP " }, {
    id: "usr_2",
    name: "QA Reviewer",
  });

  assert.equal(approved.status, "Approved");
  assert.equal(patches[0]!["approved_by_id"], "usr_2");
  assert.equal(patches[0]!["approved_by_name"], "QA Reviewer");
  assert.equal(patches[0]!["approval_note"], "Subject to TMP");
  assert.ok(patches[0]!["approved_at"] instanceof Date);
});

test("an already approved look ahead is not approved twice", async () => {
  const { repo } = fakeRepo(row("Approved"));
  const service = lookAheadsService(repo, noBuilding);
  await assert.rejects(
    service.approve("prj_1", "la_1", {}, { id: "usr_2", name: "QA Reviewer" }),
    /already approved/i,
  );
});

test("the edit drawer cannot set Approved — that is the action's job", async () => {
  const { repo } = fakeRepo(row("Draft"));
  const service = lookAheadsService(repo, noBuilding);
  await assert.rejects(
    service.update("prj_1", "la_1", { status: "Approved" }),
    /Approve action/i,
  );
});

test("moving an approved plan off Approved clears the sign-off", async () => {
  const { repo, patches } = fakeRepo(row("Approved"));
  const service = lookAheadsService(repo, noBuilding);
  await service.update("prj_1", "la_1", { status: "Draft" });
  assert.equal(patches[0]!["approved_by_id"], null);
  assert.equal(patches[0]!["approved_at"], null);
});

test("revoking approval drops the plan to Draft and records why", async () => {
  const { repo, patches } = fakeRepo(row("Approved"));
  const service = lookAheadsService(repo, noBuilding);
  const result = await service.revokeApproval("prj_1", "la_1", "Activity removed from the programme");
  assert.equal(result.status, "Draft");
  assert.equal(patches[0]!["approval_note"], "Activity removed from the programme");
  assert.equal(patches[0]!["approved_by_name"], null);
});
