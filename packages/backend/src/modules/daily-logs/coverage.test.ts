import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyLogCoverage, type CoverageDeps } from "./coverage.ts";
import type { DailyLogRow } from "./types.ts";
import type { DailyLogsRepository } from "./repository.ts";

// Sunday 13 Sep 2026; "yesterday" is Saturday 12 Sep.
const TODAY = new Date("2026-09-13T09:00:00.000Z");

function log(date: string, voided = false): DailyLogRow {
  return {
    project_id: "prj_1",
    building_id: "bld_1",
    log_date: date,
    weather_condition: null,
    temperature_c: null,
    precipitation_mm: null,
    wind_kph: null,
    workers_expected: 0,
    workers_present: 0,
    total_hours: "0",
    summary: null,
    summary_html: null,
    created_by_id: null,
    voided_at: voided ? "2026-09-13T00:00:00.000Z" : null,
    voided_by_id: null,
    void_reason: null,
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
  };
}

function build(
  logs: DailyLogRow[],
  project: { start_date: string | null; working_days?: unknown; holidays?: unknown } | undefined,
): CoverageDeps {
  return {
    repository: { listByProjectInRange: async () => logs } as unknown as DailyLogsRepository,
    projectDates: async () =>
      project
        ? {
            start_date: project.start_date,
            working_days: project.working_days ?? [1, 2, 3, 4, 5, 6],
            holidays: project.holidays ?? [],
          }
        : undefined,
    now: () => TODAY,
  };
}

test("days before the works started are not missed", async () => {
  // Site possession Mon 7 Sep; logs Mon–Sat. Nothing before 7 Sep counts.
  const logs = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"].map(
    (d) => log(d),
  );
  const result = await dailyLogCoverage(build(logs, { start_date: "2026-09-07" }), "prj_1");
  assert.equal(result.from, "2026-09-07");
  assert.equal(result.to, "2026-09-12");
  assert.equal(result.workingDays, 6);
  assert.equal(result.daysLogged, 6);
  assert.equal(result.daysMissed, 0);
});

test("Sunday is not a missed day on a six-day week", async () => {
  const result = await dailyLogCoverage(
    build([log("2026-09-07")], { start_date: "2026-09-06" }),
    "prj_1",
  );
  // 6 Sep is a Sunday, so the window is Mon 7 – Sat 12: six working days.
  assert.equal(result.workingDays, 6);
  assert.ok(!result.missedDates.includes("2026-09-06"));
});

test("Saturday is missed on a five-day week but not counted on it", async () => {
  const fiveDay = { start_date: "2026-09-07", working_days: [1, 2, 3, 4, 5] };
  const result = await dailyLogCoverage(build([], fiveDay), "prj_1");
  assert.equal(result.workingDays, 5);
  assert.deepEqual(result.missedDates, [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
  ]);
});

test("a holiday is not a missed day", async () => {
  const result = await dailyLogCoverage(
    build([], { start_date: "2026-09-07", holidays: ["2026-09-09"] }),
    "prj_1",
  );
  assert.equal(result.daysMissed, 5);
  assert.ok(!result.missedDates.includes("2026-09-09"));
});

test("a voided day is a missed day — the record was struck out", async () => {
  const logs = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"].map((d) => log(d));
  logs.push(log("2026-09-12", true));
  const result = await dailyLogCoverage(build(logs, { start_date: "2026-09-07" }), "prj_1");
  assert.equal(result.daysMissed, 1);
  assert.deepEqual(result.missedDates, ["2026-09-12"]);
});

test("today is not missed until it is over", async () => {
  const result = await dailyLogCoverage(build([], { start_date: "2026-09-07" }), "prj_1");
  assert.equal(result.to, "2026-09-12");
  assert.ok(!result.missedDates.includes("2026-09-13"));
});

test("a future-dated log does not count as coverage of a past day", async () => {
  const result = await dailyLogCoverage(
    build([log("2026-09-15")], { start_date: "2026-09-07" }),
    "prj_1",
  );
  assert.equal(result.daysLogged, 0);
  assert.equal(result.daysMissed, 6);
});

test("with no start date the count begins at the first log", async () => {
  const result = await dailyLogCoverage(
    build([log("2026-09-10"), log("2026-09-11")], { start_date: null }),
    "prj_1",
  );
  assert.equal(result.from, "2026-09-10");
  assert.deepEqual(result.missedDates, ["2026-09-12"]);
});

test("a job that has not started yet reports nothing missed", async () => {
  const result = await dailyLogCoverage(build([], { start_date: "2026-10-01" }), "prj_1");
  assert.equal(result.daysMissed, 0);
  assert.equal(result.to, null);
});

test("no logs and no start date is an empty figure, not zero out of nothing", async () => {
  const result = await dailyLogCoverage(build([], { start_date: null }), "prj_1");
  assert.equal(result.from, null);
  assert.equal(result.workingDays, 0);
});

test("the calendar used is reported so the figure can be explained", async () => {
  const result = await dailyLogCoverage(
    build([], { start_date: "2026-09-07", working_days: [1, 2, 3, 4, 5], holidays: ["2026-09-09"] }),
    "prj_1",
  );
  assert.deepEqual(result.calendar, { workingDays: [1, 2, 3, 4, 5], holidays: ["2026-09-09"] });
});
