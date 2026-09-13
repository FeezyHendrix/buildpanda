import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkingCalendar } from "../../lib/working-days.ts";
import { cascadeShift } from "./cascade.ts";
import { activityRow, fakeRepository, type FakeStore } from "./fake-repository.ts";

const MON_FRI: WorkingCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: [] };

function store(activities = [activityRow()]): FakeStore {
  return { activities, delays: [], reasons: [], events: [] };
}

function deps(s: FakeStore, onShift?: (projectId: string, moves: unknown[]) => Promise<void>) {
  return {
    repository: fakeRepository(s),
    calendarFor: async () => MON_FRI,
    ...(onShift ? { onActivitiesShifted: onShift as never } : {}),
  };
}

const ctx = { actorId: "usr_1", delayId: "delay_1", kind: "delay_shift", summary: "rain" };

test("a shift moves the planned finish by working days and stamps the baseline", async () => {
  const s = store();
  await cascadeShift(deps(s), "prj_1", "act_1", 1, ctx);
  const row = s.activities[0]!;
  // Mon 14 Sep + 1 working day = Tue 15 Sep.
  assert.equal(row.planned_end_at, "2026-09-15T17:00:00.000Z");
  assert.equal(row.baseline_end_at, "2026-09-14T17:00:00.000Z");
  assert.equal(row.baseline_start_at, "2026-09-07T07:00:00.000Z");
});

test("an activity that has not started moves its start too; one in progress does not", async () => {
  const s = store([
    activityRow({ id: "act_a" }),
    activityRow({ id: "act_b", actual_start_at: "2026-09-07T07:00:00.000Z" }),
  ]);
  await cascadeShift(deps(s), "prj_1", "act_a", 2, ctx);
  assert.equal(s.activities[0]!.planned_start_at, "2026-09-09T07:00:00.000Z");

  await cascadeShift(deps(s), "prj_1", "act_b", 2, ctx);
  assert.equal(s.activities[1]!.planned_start_at, "2026-09-07T07:00:00.000Z");
  assert.equal(s.activities[1]!.planned_end_at, "2026-09-16T17:00:00.000Z");
});

test("successors move transitively by the same number of days", async () => {
  const s = store([
    activityRow({ id: "act_1" }),
    activityRow({ id: "act_2", predecessors: [{ activityId: "act_1", type: "FS", lagDays: 0 }] }),
    activityRow({ id: "act_3", predecessors: [{ activityId: "act_2", type: "FS", lagDays: 0 }] }),
    activityRow({ id: "act_unrelated" }),
  ]);
  const moves = await cascadeShift(deps(s), "prj_1", "act_1", 6, ctx);
  assert.deepEqual(moves.map((m) => m.id).sort(), ["act_1", "act_2", "act_3"]);
  assert.equal(s.activities[3]!.planned_end_at, "2026-09-14T17:00:00.000Z");
});

test("predecessors stored as a json string are followed too", async () => {
  const s = store([
    activityRow({ id: "act_1" }),
    activityRow({
      id: "act_2",
      predecessors: JSON.stringify([{ activityId: "act_1", type: "FS", lagDays: 0 }]),
    }),
  ]);
  const moves = await cascadeShift(deps(s), "prj_1", "act_1", 1, ctx);
  assert.equal(moves.length, 2);
});

test("a cycle in the dependency graph terminates and moves each activity once", async () => {
  const s = store([
    activityRow({ id: "act_1", predecessors: [{ activityId: "act_2", type: "FS", lagDays: 0 }] }),
    activityRow({ id: "act_2", predecessors: [{ activityId: "act_1", type: "FS", lagDays: 0 }] }),
  ]);
  const moves = await cascadeShift(deps(s), "prj_1", "act_1", 1, ctx);
  assert.equal(moves.length, 2);
  assert.equal(s.activities[0]!.planned_end_at, "2026-09-15T17:00:00.000Z");
});

test("the shift reverses exactly — the programme returns to where it was", async () => {
  const s = store([
    activityRow({ id: "act_1" }),
    activityRow({ id: "act_2", predecessors: [{ activityId: "act_1", type: "FS", lagDays: 0 }] }),
  ]);
  await cascadeShift(deps(s), "prj_1", "act_1", 6, ctx);
  await cascadeShift(deps(s), "prj_1", "act_1", -6, ctx);
  assert.equal(s.activities[0]!.planned_end_at, "2026-09-14T17:00:00.000Z");
  assert.equal(s.activities[1]!.planned_start_at, "2026-09-07T07:00:00.000Z");
});

test("a zero shift is a no-op — no writes, no events", async () => {
  const s = store();
  const moves = await cascadeShift(deps(s), "prj_1", "act_1", 0, ctx);
  assert.deepEqual(moves, []);
  assert.equal(s.events.length, 0);
  assert.equal(s.activities[0]!.baseline_end_at, null);
});

test("every move writes an attributed activity event", async () => {
  const s = store();
  await cascadeShift(deps(s), "prj_1", "act_1", 3, ctx);
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0]!.actor_id, "usr_1");
  assert.equal(s.events[0]!.days_delta, 3);
  assert.equal(s.events[0]!.delay_id, "delay_1");
});

test("the moves are handed on so anchored key dates can follow", async () => {
  const s = store();
  const seen: unknown[] = [];
  await cascadeShift(
    deps(s, async (_projectId, moves) => {
      seen.push(...moves);
    }),
    "prj_1",
    "act_1",
    2,
    ctx,
  );
  assert.equal(seen.length, 1);
});
