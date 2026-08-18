import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addWorkingDays,
  scheduleProgramme,
  workingDaysBetween,
  type SchedulableTask,
} from "./programme-schedule.ts";

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function task(id: string, durationDays: number, extra: Partial<SchedulableTask> = {}): SchedulableTask {
  return { id, durationDays, predecessors: [], outlineLevel: 2, parentTaskId: null, ...extra };
}

// 2026-09-07 is a Monday.
const MONDAY = new Date("2026-09-07T00:00:00Z");

test("addWorkingDays skips weekends", () => {
  assert.equal(iso(addWorkingDays(MONDAY, 4)), "2026-09-11", "Mon + 4 = Fri");
  assert.equal(iso(addWorkingDays(MONDAY, 5)), "2026-09-14", "Mon + 5 jumps the weekend to Mon");
});

test("a start date landing on a weekend rolls forward to Monday", () => {
  const saturday = new Date("2026-09-05T00:00:00Z");
  const dates = scheduleProgramme([task("a", 1)], saturday);
  assert.equal(iso(dates.get("a")!.start), "2026-09-07");
});

test("finish-to-start chains run sequentially", () => {
  const tasks = [
    task("a", 5),
    task("b", 5, { predecessors: [{ taskId: "a", type: "FS", lagDays: 0 }] }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(iso(dates.get("a")!.finish), "2026-09-14");
  assert.equal(iso(dates.get("b")!.start), "2026-09-14", "b starts when a finishes");
  assert.equal(iso(dates.get("b")!.finish), "2026-09-21");
});

test("FS lag pushes the successor out", () => {
  const tasks = [
    task("a", 5),
    task("b", 1, { predecessors: [{ taskId: "a", type: "FS", lagDays: 2 }] }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(iso(dates.get("b")!.start), "2026-09-16", "two working days after a finishes");
});

test("start-to-start overlaps trades", () => {
  const tasks = [
    task("a", 10),
    task("b", 3, { predecessors: [{ taskId: "a", type: "SS", lagDays: 2 }] }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(iso(dates.get("b")!.start), "2026-09-09", "starts 2 days after a starts, not after it finishes");
});

test("a task waits for its latest predecessor", () => {
  const tasks = [
    task("short", 2),
    task("long", 8),
    task("join", 1, {
      predecessors: [
        { taskId: "short", type: "FS", lagDays: 0 },
        { taskId: "long", type: "FS", lagDays: 0 },
      ],
    }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(
    dates.get("join")!.start.getTime(),
    dates.get("long")!.finish.getTime(),
    "driven by the longer chain",
  );
});

test("independent chains run in parallel", () => {
  const dates = scheduleProgramme([task("a", 5), task("b", 5)], MONDAY);
  assert.equal(
    dates.get("a")!.start.getTime(),
    dates.get("b")!.start.getTime(),
    "no dependency means both start at project start",
  );
});

test("a milestone is zero duration and does not advance the date", () => {
  const tasks = [
    task("work", 5),
    task("done", 0, {
      isMilestone: true,
      predecessors: [{ taskId: "work", type: "FS", lagDays: 0 }],
    } as Partial<SchedulableTask>),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  const milestone = dates.get("done")!;
  assert.equal(milestone.start.getTime(), milestone.finish.getTime(), "milestone has no span");
});

test("a parent task spans its children", () => {
  const tasks = [
    task("phase", 0, { outlineLevel: 1 }),
    task("first", 5, { parentTaskId: "phase" }),
    task("second", 5, {
      parentTaskId: "phase",
      predecessors: [{ taskId: "first", type: "FS", lagDays: 0 }],
    }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(
    dates.get("phase")!.finish.getTime(),
    dates.get("second")!.finish.getTime(),
    "parent finishes with its last child",
  );
  assert.equal(iso(dates.get("phase")!.start), iso(dates.get("first")!.start));
});

test("a dependency cycle still produces a schedule", () => {
  const tasks = [
    task("a", 2, { predecessors: [{ taskId: "b", type: "FS", lagDays: 0 }] }),
    task("b", 2, { predecessors: [{ taskId: "a", type: "FS", lagDays: 0 }] }),
  ];
  const dates = scheduleProgramme(tasks, MONDAY);
  assert.equal(dates.size, 2, "both tasks scheduled rather than hanging or throwing");
});

test("a predecessor that does not exist is ignored", () => {
  const dates = scheduleProgramme(
    [task("a", 3, { predecessors: [{ taskId: "ghost", type: "FS", lagDays: 0 }] })],
    MONDAY,
  );
  assert.equal(iso(dates.get("a")!.start), "2026-09-07", "falls back to project start");
});

test("workingDaysBetween excludes weekends", () => {
  assert.equal(workingDaysBetween(MONDAY, new Date("2026-09-14T00:00:00Z")), 5);
});
