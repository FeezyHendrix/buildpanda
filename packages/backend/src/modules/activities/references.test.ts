import { test } from "node:test";
import assert from "node:assert/strict";
import { activityReferencesService } from "./references-service.ts";
import type { ActivityReferencesRepository } from "./references-repository.ts";

function repo(overrides: Partial<ActivityReferencesRepository> = {}): ActivityReferencesRepository {
  return {
    activityProjectId: async () => ({ project_id: "prj_1" }),
    lookAheadsForActivity: async () => [],
    delaysForActivity: async () => [],
    ...overrides,
  } as ActivityReferencesRepository;
}

test("an activity in an approved look ahead is flagged as blocked", async () => {
  const service = activityReferencesService(
    repo({
      lookAheadsForActivity: async () => [
        { id: "la_1", name: "Weeks 2-3", status: "Approved", start_date: "2026-09-14", end_date: "2026-09-27" },
        { id: "la_2", name: "Weeks 4-5", status: "Draft", start_date: "2026-09-28", end_date: "2026-10-11" },
      ],
    }),
  );

  const result = await service.get("prj_1", "act_1");
  assert.equal(result.lookAheads.length, 2);
  assert.equal(result.blockedByApprovedLookAhead, true);
  assert.equal(result.lookAheads[0]!.startDate, "2026-09-14");
});

test("only draft look aheads means nothing is blocked", async () => {
  const service = activityReferencesService(
    repo({
      lookAheadsForActivity: async () => [
        { id: "la_2", name: "Weeks 4-5", status: "Draft", start_date: "2026-09-28", end_date: "2026-10-11" },
      ],
    }),
  );
  assert.equal((await service.get("prj_1", "act_1")).blockedByApprovedLookAhead, false);
});

test("open delays are counted, resolved ones are not", async () => {
  const service = activityReferencesService(
    repo({
      delaysForActivity: async () => [
        { id: "dly_1", reason_code: "Rain", started_at: "2026-09-10T05:00:00.000Z", resolved_at: null },
        { id: "dly_2", reason_code: "Rain", started_at: "2026-09-11T05:00:00.000Z", resolved_at: "2026-09-12T17:00:00.000Z" },
      ],
    }),
  );
  const result = await service.get("prj_1", "act_1");
  assert.equal(result.delays.length, 2);
  assert.equal(result.openDelayCount, 1);
  assert.equal(result.delays[1]!.resolved, true);
});

test("an activity from another project is not found", async () => {
  const service = activityReferencesService(repo({ activityProjectId: async () => ({ project_id: "prj_other" }) }));
  await assert.rejects(service.get("prj_1", "act_1"), /not found/i);
});
