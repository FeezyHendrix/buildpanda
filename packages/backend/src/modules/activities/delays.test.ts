import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkingCalendar } from "../../lib/working-days.ts";
import { delaysService } from "./delays.ts";
import {
  activityRow,
  DELIVERY,
  fakeRepository,
  RAIN,
  type FakeStore,
} from "./fake-repository.ts";

const MON_FRI: WorkingCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: [] };
const ACTOR = { id: "usr_1", name: "QA Reviewer" };
const TODAY = new Date("2026-09-13T12:00:00.000Z");

function build(activities = [activityRow()]) {
  const store: FakeStore = { activities, delays: [], reasons: [RAIN, DELIVERY], events: [] };
  const service = delaysService(fakeRepository(store), {
    calendarFor: async () => MON_FRI,
    now: () => TODAY,
  });
  return { store, service };
}

test("culpability and EOT eligibility default from the reason", async () => {
  const { service } = build();
  const rain = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  assert.equal(rain.culpability, "neutral");
  assert.equal(rain.eotClaimable, true);

  const late = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "MATERIAL_DELIVERY", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  assert.equal(late.culpability, "contractor");
  assert.equal(late.eotClaimable, false);
});

test("culpability can be overridden on create", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", culpability: "client" },
    ACTOR,
  );
  assert.equal(delay.culpability, "client");
});

test("a contractor-culpable delay can never be flagged EOT-claimable", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    {
      reasonCode: "MATERIAL_DELIVERY",
      startedAt: "2026-09-10T05:00:00.000Z",
      culpability: "contractor",
      eotClaimable: true,
    },
    ACTOR,
  );
  assert.equal(delay.eotClaimable, false);
});

test("a delay cannot start in the future — it is a record, not a risk", async () => {
  const { service } = build();
  await assert.rejects(
    service.raise(
      "prj_1",
      "act_1",
      { reasonCode: "WEATHER_RAIN", startedAt: "2026-10-14T05:00:00.000Z" },
      ACTOR,
    ),
    /record of something that happened/i,
  );
});

test("a delay started today is accepted", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-13T05:00:00.000Z" },
    ACTOR,
  );
  assert.equal(delay.daysLost, 0);
});

test("endedAt before startedAt is rejected", async () => {
  const { service } = build();
  await assert.rejects(
    service.raise(
      "prj_1",
      "act_1",
      {
        reasonCode: "WEATHER_RAIN",
        startedAt: "2026-09-10T05:00:00.000Z",
        endedAt: "2026-09-09T05:00:00.000Z",
      },
      ACTOR,
    ),
    /endedAt cannot be before startedAt/i,
  );
});

test("days lost cascade on create and are recorded as applied", async () => {
  const { store, service } = build([
    activityRow({ id: "act_1" }),
    activityRow({ id: "act_2", predecessors: [{ activityId: "act_1", type: "FS", lagDays: 0 }] }),
  ]);
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", daysLost: 6 },
    ACTOR,
  );
  assert.equal(delay.appliedShiftDays, 6);
  assert.equal(store.activities[0]!.planned_end_at, "2026-09-22T17:00:00.000Z");
  assert.equal(store.activities[1]!.planned_end_at, "2026-09-22T17:00:00.000Z");
});

test("a zero-day delay moves nothing", async () => {
  const { store, service } = build();
  await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  assert.equal(store.activities[0]!.planned_end_at, "2026-09-14T17:00:00.000Z");
});

test("re-measuring days lost applies only the difference", async () => {
  const { store, service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", daysLost: 6 },
    ACTOR,
  );
  const end6 = store.activities[0]!.planned_end_at;
  const amended = await service.amend("prj_1", "act_1", delay.id, { daysLost: 4 }, ACTOR);
  assert.equal(amended.daysLost, 4);
  assert.equal(amended.appliedShiftDays, 4);
  // 6 days out then 2 back = 4 working days from the original Mon 14 Sep.
  assert.notEqual(store.activities[0]!.planned_end_at, end6);
  assert.equal(store.activities[0]!.planned_end_at, "2026-09-18T17:00:00.000Z");
});

test("amending to the same days lost moves nothing (idempotent)", async () => {
  const { store, service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", daysLost: 3 },
    ACTOR,
  );
  const before = store.activities[0]!.planned_end_at;
  await service.amend("prj_1", "act_1", delay.id, { daysLost: 3 }, ACTOR);
  assert.equal(store.activities[0]!.planned_end_at, before);
});

test("re-measuring to zero pulls the programme all the way back", async () => {
  const { store, service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", daysLost: 6 },
    ACTOR,
  );
  await service.amend("prj_1", "act_1", delay.id, { daysLost: 0 }, ACTOR);
  assert.equal(store.activities[0]!.planned_end_at, "2026-09-14T17:00:00.000Z");
});

test("ending a delay closes it out and attributes the resolution", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  const resolved = await service.amend(
    "prj_1",
    "act_1",
    delay.id,
    { endedAt: "2026-09-11T17:00:00.000Z", daysLost: 1 },
    ACTOR,
  );
  assert.equal(resolved.endedAt, "2026-09-11T17:00:00.000Z");
  assert.equal(resolved.resolvedAt, "2026-09-11T17:00:00.000Z");
  assert.equal(resolved.resolvedById, "usr_1");
});

test("re-resolving an already resolved delay is a 409", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  await service.amend("prj_1", "act_1", delay.id, { resolvedAt: "2026-09-11T17:00:00.000Z" }, ACTOR);
  await assert.rejects(
    service.amend("prj_1", "act_1", delay.id, { resolvedAt: "2026-09-12T17:00:00.000Z" }, ACTOR),
    /already resolved/i,
  );
});

test("re-attributing to the contractor drops the EOT flag", async () => {
  const { service } = build();
  const delay = await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z" },
    ACTOR,
  );
  const amended = await service.amend(
    "prj_1",
    "act_1",
    delay.id,
    { culpability: "contractor" },
    ACTOR,
  );
  assert.equal(amended.eotClaimable, false);
});

test("the delay register for an activity reads back with its reason name", async () => {
  const { service } = build();
  await service.raise(
    "prj_1",
    "act_1",
    { reasonCode: "WEATHER_RAIN", startedAt: "2026-09-10T05:00:00.000Z", daysLost: 1 },
    ACTOR,
  );
  const list = await service.listForActivity("prj_1", "act_1");
  assert.equal(list.length, 1);
  assert.equal(list[0]!.reasonName, "Rain");
});

test("an unknown reason code is rejected", async () => {
  const { service } = build();
  await assert.rejects(
    service.raise(
      "prj_1",
      "act_1",
      { reasonCode: "NOPE", startedAt: "2026-09-10T05:00:00.000Z" },
      ACTOR,
    ),
    /Unknown delay reason/i,
  );
});
