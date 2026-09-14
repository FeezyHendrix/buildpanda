import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkingCalendar } from "../../lib/working-days.ts";
import { activitiesService, deriveStatus } from "./service.ts";
import { activityRow, fakeRepository, RAIN, type FakeStore } from "./fake-repository.ts";

const MON_FRI: WorkingCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: [] };

function build(activities = [activityRow()]) {
  const store: FakeStore = { activities, delays: [], reasons: [RAIN], events: [] };
  const service = activitiesService(
    fakeRepository(store),
    async () => {},
    async () => "bld_1",
    { calendarFor: async () => MON_FRI },
  );
  return { store, service };
}

test("an actual finish makes the activity Completed", () => {
  assert.equal(deriveStatus("Planned", null, "2026-09-12T17:00:00.000Z"), "Completed");
});

test("an actual start makes the activity InProgress", () => {
  assert.equal(deriveStatus("Planned", "2026-09-11T07:00:00.000Z", null), "InProgress");
});

test("clearing the actual dates takes a Completed activity back to Planned", () => {
  assert.equal(deriveStatus("Completed", null, null), "Planned");
});

test("Cancelled is a decision and is never overwritten", () => {
  assert.equal(deriveStatus("Cancelled", "2026-09-11T07:00:00.000Z", "2026-09-12T17:00:00.000Z"), "Cancelled");
});

test("saving actual dates flips the status and completes the progress", async () => {
  const { store, service } = build();
  const updated = await service.update("prj_1", "act_1", {
    actualStartAt: "2026-09-11T07:00:00.000Z",
    actualEndAt: "2026-09-12T17:00:00.000Z",
  });
  assert.equal(updated.status, "Completed");
  assert.equal(updated.percentComplete, 100);
  assert.equal(store.activities[0]!.status, "Completed");
});

test("an actual start alone flips the activity to InProgress", async () => {
  const { service } = build();
  const updated = await service.update("prj_1", "act_1", {
    actualStartAt: "2026-09-11T07:00:00.000Z",
  });
  assert.equal(updated.status, "InProgress");
});

test("percentComplete is persisted — it used to be silently stripped", async () => {
  const { store, service } = build();
  const updated = await service.update("prj_1", "act_1", { percentComplete: 60 });
  assert.equal(updated.percentComplete, 60);
  assert.equal(store.activities[0]!.percent_complete, 60);
});

test("marking an activity Completed by hand sets it to 100%", async () => {
  const { service } = build();
  const updated = await service.update("prj_1", "act_1", { status: "Completed" });
  assert.equal(updated.percentComplete, 100);
});

test("duration is working days on the project calendar, both ends inclusive", async () => {
  const { service } = build([
    activityRow({
      planned_start_at: "2026-09-07T07:00:00.000Z",
      planned_end_at: "2026-09-11T17:00:00.000Z",
    }),
  ]);
  const [activity] = await service.listByProject("prj_1");
  // Mon–Fri is five working days, not the "4 days" end-minus-start gave.
  assert.equal(activity!.durationWorkingDays, 5);
});

test("an empty location is stored as no location, not a rejected empty string", async () => {
  const { store, service } = build([]);
  await service.create(
    "prj_1",
    {
      name: "Cut to formation",
      activityType: "works",
      location: "",
      plannedStartAt: "2026-09-07T07:00:00.000Z",
      plannedEndAt: "2026-09-11T17:00:00.000Z",
    },
    { id: "usr_1", name: "QA" },
  );
  assert.equal(store.activities[0]!.location, null);
});

test("predecessors given on create are persisted", async () => {
  const { store, service } = build([]);
  await service.create(
    "prj_1",
    {
      name: "Cast culvert 1",
      activityType: "works",
      plannedStartAt: "2026-09-07T07:00:00.000Z",
      plannedEndAt: "2026-09-11T17:00:00.000Z",
      predecessors: [{ activityId: "act_1", type: "FS", lagDays: 0 }],
    },
    { id: "usr_1", name: "QA" },
  );
  assert.equal(store.activities[0]!.predecessors, JSON.stringify([{ activityId: "act_1", type: "FS", lagDays: 0 }]));
});

test("planned end before planned start is refused with the reason", async () => {
  const { service } = build([]);
  await assert.rejects(
    service.create(
      "prj_1",
      {
        name: "Backwards",
        activityType: "works",
        plannedStartAt: "2026-09-11T17:00:00.000Z",
        plannedEndAt: "2026-09-07T07:00:00.000Z",
      },
      { id: "usr_1", name: "QA" },
    ),
    /end must be on or after start/i,
  );
});
