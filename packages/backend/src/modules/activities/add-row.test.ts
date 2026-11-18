import assert from "node:assert/strict";
import { test } from "node:test";
import { activityRow, fakeRepository, type FakeStore } from "./fake-repository.ts";
import { activitiesService } from "./service.ts";

const input = {
  name: "Roof trusses",
  activityType: "works",
  plannedStartAt: "2026-09-07T07:00:00.000Z",
  plannedEndAt: "2026-09-14T17:00:00.000Z",
};
const actor = { id: "usr_1", name: "PM" };

function setup() {
  const store: FakeStore = {
    activities: [
      activityRow({ id: "act_parent", project_id: "prj_1", outline_level: 2 }),
      activityRow({ id: "act_other", project_id: "prj_2" }),
    ],
    delays: [],
    reasons: [],
    events: [],
  };
  return { store, service: activitiesService(fakeRepository(store)) };
}

test("a row added from the chart is saved under the row it was added to", async () => {
  const { store, service } = setup();
  const created = await service.create("prj_1", { ...input, parentActivityId: "act_parent" }, actor);
  assert.equal(created.parentActivityId, "act_parent");
  assert.equal(store.activities.find((a) => a.id === created.id)?.outline_level, 3);
});

test("a row cannot be added under another project's activity", async () => {
  const { store, service } = setup();
  await assert.rejects(service.create("prj_1", { ...input, parentActivityId: "act_other" }, actor));
  assert.equal(store.activities.length, 2);
});
