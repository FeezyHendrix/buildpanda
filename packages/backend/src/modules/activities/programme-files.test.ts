import assert from "node:assert/strict";
import { test } from "node:test";
import { programmeRows, programmeToPdf, programmeToXlsx } from "./programme-files.ts";
import type { Activity } from "./types.ts";

const base = {
  projectId: "p",
  buildingId: "b",
  phaseId: null,
  activityType: "Task",
  location: null,
  status: "Planned",
  actualStartAt: null,
  actualEndAt: null,
  workerCountPlanned: 0,
  assigneeId: null,
  notes: null,
  wbsCode: null,
  outlineLevel: 1,
  parentActivityId: null,
  isSummary: false,
  isMilestone: false,
  percentComplete: 0,
  durationDays: 5,
  baselineStartAt: null,
  baselineEndAt: null,
  isDelayed: false,
  delays: [],
  predecessors: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as unknown as Activity;

const activities: Activity[] = [
  { ...base, id: "a1", name: "Excavate", wbsCode: "1.1", plannedStartAt: "2026-02-01T00:00:00Z", plannedEndAt: "2026-02-05T00:00:00Z", baselineEndAt: "2026-02-04T00:00:00Z" },
  {
    ...base,
    id: "a2",
    name: "Blind",
    plannedStartAt: "2026-02-06T00:00:00Z",
    plannedEndAt: "2026-02-07T00:00:00Z",
    parentActivityId: "a1",
    predecessors: [{ activityId: "a1", type: "FS", lagDays: 1 }],
    delays: [{ reasonName: "Rain", daysLost: 2, resolvedAt: null } as never],
  },
];

test("rows resolve predecessors and parents to names and keep delays readable", () => {
  const rows = programmeRows(activities);
  assert.equal(rows[1]!.parent, "Excavate");
  assert.equal(rows[1]!.predecessors, "1.1 FS+1d");
  assert.equal(rows[1]!.delays, "Rain: 2d (open)");
  assert.equal(rows[0]!.baselineEnd, "2026-02-04");
});

test("xlsx and pdf writers produce real files", async () => {
  const xlsx = await programmeToXlsx("Demo", activities);
  assert.equal(xlsx.subarray(0, 2).toString(), "PK", "xlsx is a zip");
  const pdf = await programmeToPdf("Demo", activities);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
