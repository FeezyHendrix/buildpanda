import { test } from "node:test";
import assert from "node:assert/strict";
import { keyDatesService } from "../key-dates/service.ts";
import type { KeyDatesRepository } from "../key-dates/repository.ts";
import type { KeyDatePatch, KeyDateRow } from "../key-dates/types.ts";
import { awardTime } from "./time-award.ts";

/**
 * One award, one number of days, everywhere.
 *
 * The road job drifted because the two halves of an award were applied
 * separately: the project's revised completion moved and a contract date that
 * nobody had flagged as contractual — defects liability — stayed put. These
 * tests run the real key-dates service, not a spy, so the day count on the
 * project and the day count on every contract date have to agree.
 */

function keyDate(over: Partial<KeyDateRow> = {}): KeyDateRow {
  return {
    id: "kd_1",
    project_id: "prj_road",
    building_id: "bld_1",
    label: "Practical completion",
    target_date: "2027-03-26",
    actual_date: null,
    status: "Upcoming",
    notes: null,
    linked_activity_id: null,
    is_contractual: true,
    revised_from: null,
    sort_order: 0,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function build(rows: KeyDateRow[], completionDate = "2027-03-26") {
  const store = rows;
  const project = { completion_date: completionDate, revised_completion_date: null as string | null };

  const repository = {
    listByProject: async () => store,
    findById: async (id: string) => store.find((r) => r.id === id),
    linkedToActivities: async () => [],
    contractualForProject: async (projectId: string) =>
      store.filter((r) => r.project_id === projectId && r.is_contractual && r.target_date),
    insert: async (record: Record<string, unknown>) => {
      const created = keyDate(record as Partial<KeyDateRow>);
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
    activityBelongsToProject: async () => undefined,
    projectCalendar: async () => ({ working_days: [1, 2, 3, 4, 5, 6], holidays: [] }),
  } as unknown as KeyDatesRepository;

  const keyDates = keyDatesService(repository, async () => "bld_1");
  const award = (days: number) =>
    awardTime("prj_road", days, {
      dates: async () => project,
      setRevisedCompletion: async (_id, date) => {
        project.revised_completion_date = date;
      },
      shiftContractualKeyDates: (id, delta) => keyDates.shiftContractual(id, delta),
    });

  return { store, project, keyDates, award };
}

/** Whole days between two ISO dates. */
function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

test("one award moves the revised completion and every contractual key date by the same days", async () => {
  const { store, project, award } = build([
    keyDate({ id: "kd_pc", label: "Practical completion", target_date: "2027-03-26" }),
    keyDate({ id: "kd_sec", label: "Sectional completion - section 2", target_date: "2027-01-15" }),
    keyDate({ id: "kd_dlp", label: "Defects liability ends", target_date: "2028-03-26" }),
    keyDate({ id: "kd_cul", label: "Culverts complete", target_date: "2026-11-27", is_contractual: false }),
  ]);

  const result = await award(6);

  assert.equal(result.keyDatesMoved, 3, "all three contract dates move, defects liability included");
  assert.equal(daysApart("2027-03-26", project.revised_completion_date!), 6);

  const moved = store.filter((r) => r.is_contractual);
  for (const row of moved) {
    assert.equal(
      daysApart(row.revised_from!, row.target_date!),
      6,
      `${row.label} moved by a different number of days`,
    );
  }

  // Defects liability is the one the drift hid; name it explicitly.
  assert.equal(store.find((r) => r.id === "kd_dlp")!.target_date, "2028-04-01");
  assert.equal(store.find((r) => r.id === "kd_pc")!.target_date, "2027-04-01");
  assert.equal(project.revised_completion_date, "2027-04-01");

  // The programme date is not a contract date and does not move.
  assert.equal(store.find((r) => r.id === "kd_cul")!.target_date, "2026-11-27");
});

test("a second award compounds on every contract date by the same number of days", async () => {
  const { store, project, award } = build([
    keyDate({ id: "kd_pc", label: "Practical completion", target_date: "2027-03-26" }),
    keyDate({ id: "kd_dlp", label: "Defects liability ends", target_date: "2028-03-26" }),
  ]);

  await award(3);
  await award(3);

  assert.equal(project.revised_completion_date, "2027-04-01");
  for (const row of store) {
    // revised_from is stamped once, so the total is still legible in a dispute.
    assert.equal(daysApart(row.revised_from!, row.target_date!), 6);
  }
  assert.equal(store.find((r) => r.id === "kd_dlp")!.revised_from, "2028-03-26");
});

test("a defects-liability key date is contractual without anyone ticking a box", async () => {
  const { store, keyDates } = build([]);

  await keyDates.create("prj_road", { label: "Defects liability ends", targetDate: "2028-03-26" });
  await keyDates.create("prj_road", { label: "Culverts complete", targetDate: "2026-11-27" });

  assert.equal(store.find((r) => r.label === "Defects liability ends")!.is_contractual, true);
  assert.equal(store.find((r) => r.label === "Culverts complete")!.is_contractual, false);
});

test("an explicit flag still wins over the label", async () => {
  const { store, keyDates } = build([]);

  await keyDates.create("prj_road", {
    label: "Practical completion (indicative only)",
    targetDate: "2027-03-26",
    isContractual: false,
  });

  assert.equal(store[0]!.is_contractual, false);
});
