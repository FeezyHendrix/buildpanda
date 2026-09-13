import { test } from "node:test";
import assert from "node:assert/strict";
import { keyDatesService } from "./service.ts";
import type { KeyDatesRepository } from "./repository.ts";
import type { KeyDatePatch, KeyDateRow } from "./types.ts";

function row(over: Partial<KeyDateRow> = {}): KeyDateRow {
  return {
    id: "kd_1",
    project_id: "prj_1",
    building_id: "bld_1",
    label: "Culverts complete",
    target_date: "2026-11-27",
    actual_date: null,
    status: "Upcoming",
    notes: null,
    linked_activity_id: "act_1",
    is_contractual: false,
    revised_from: null,
    sort_order: 0,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function build(rows: KeyDateRow[]) {
  const store = rows;
  const repository = {
    listByProject: async () => store,
    findById: async (id: string) => store.find((r) => r.id === id),
    linkedToActivities: async (ids: string[]) =>
      store.filter((r) => !r.is_contractual && ids.includes(r.linked_activity_id ?? "")),
    contractualForProject: async (projectId: string) =>
      store.filter((r) => r.project_id === projectId && r.is_contractual && r.target_date),
    insert: async (record: Record<string, unknown>) => {
      const created = row(record as Partial<KeyDateRow>);
      store.push(created);
      return created;
    },
    update: async (id: string, patch: KeyDatePatch) => {
      const found = store.find((r) => r.id === id);
      if (!found) return undefined;
      Object.assign(found, patch);
      return found;
    },
    remove: async () => {},
    activityBelongsToProject: async (activityId: string) =>
      activityId === "act_1" ? { id: "act_1" } : undefined,
    // Mon–Fri, so a shift skips the weekend.
    projectCalendar: async () => ({ working_days: [1, 2, 3, 4, 5], holidays: [] }),
  } as unknown as KeyDatesRepository;
  return { store, service: keyDatesService(repository, async () => "bld_1") };
}

test("a key date anchored to a delayed activity moves with it", async () => {
  const { store, service } = build([row()]);
  const moved = await service.shiftForActivityMoves("prj_1", [{ id: "act_1", days: 6 }]);
  assert.equal(moved, 1);
  // Fri 27 Nov + 6 working days = Mon 7 Dec.
  assert.equal(store[0]!.target_date, "2026-12-07");
});

test("revised_from is stamped once, with the date originally programmed", async () => {
  const { store, service } = build([row()]);
  await service.shiftForActivityMoves("prj_1", [{ id: "act_1", days: 3 }]);
  await service.shiftForActivityMoves("prj_1", [{ id: "act_1", days: 3 }]);
  assert.equal(store[0]!.revised_from, "2026-11-27");
});

test("a contractual key date never drifts with the programme", async () => {
  const { store, service } = build([
    row({ id: "kd_pc", label: "Practical completion", target_date: "2027-03-26", is_contractual: true }),
  ]);
  const moved = await service.shiftForActivityMoves("prj_1", [{ id: "act_1", days: 6 }]);
  assert.equal(moved, 0);
  assert.equal(store[0]!.target_date, "2027-03-26");
});

test("an awarded EOT moves contractual dates by calendar days", async () => {
  const { store, service } = build([
    row({ id: "kd_pc", label: "Practical completion", target_date: "2027-03-26", is_contractual: true }),
    row({ id: "kd_cul", target_date: "2026-11-27", is_contractual: false }),
  ]);
  const moved = await service.shiftContractual("prj_1", 14);
  assert.equal(moved, 1);
  assert.equal(store[0]!.target_date, "2027-04-09");
  assert.equal(store[0]!.revised_from, "2027-03-26");
  assert.equal(store[1]!.target_date, "2026-11-27");
});

test("a zero award moves nothing", async () => {
  const { store, service } = build([
    row({ id: "kd_pc", target_date: "2027-03-26", is_contractual: true }),
  ]);
  assert.equal(await service.shiftContractual("prj_1", 0), 0);
  assert.equal(store[0]!.revised_from, null);
});

test("linking a key date to an activity from another project is refused", async () => {
  const { service } = build([]);
  await assert.rejects(
    service.create("prj_1", { label: "Formation approved", linkedActivityId: "act_other" }),
    /does not belong to this project/i,
  );
});

test("a key date with no target date is skipped rather than corrupted", async () => {
  const { store, service } = build([row({ target_date: null })]);
  assert.equal(await service.shiftForActivityMoves("prj_1", [{ id: "act_1", days: 6 }]), 0);
  assert.equal(store[0]!.target_date, null);
});
