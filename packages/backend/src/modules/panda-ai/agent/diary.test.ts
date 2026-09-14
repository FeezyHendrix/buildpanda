import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeDiary, diaryDates, type DiaryLogRow } from "./diary.ts";

/**
 * The dogfood run's diary summary reported 15 September — two days in the
 * future — as a normal working day and folded its 100 hours into the week's
 * total, and never said what work the hours went on. These pin both.
 */
const TODAY = "2026-09-13";

const logs: DiaryLogRow[] = [
  {
    log_date: "2026-09-15",
    weather_condition: null,
    temperature_c: "30",
    workers_present: 12,
    workers_expected: 12,
    total_hours: "100",
    summary: null,
    voided_at: null,
  },
  {
    log_date: "2026-09-12",
    weather_condition: "Sunny",
    temperature_c: "30",
    workers_present: 8,
    workers_expected: 8,
    total_hours: "48",
    summary: null,
    voided_at: null,
  },
  {
    log_date: "2026-09-11",
    weather_condition: "Cloudy",
    temperature_c: "27",
    workers_present: 14,
    workers_expected: 14,
    total_hours: "126",
    summary: null,
    voided_at: "2026-09-12T08:00:00.000Z",
  },
];

test("a log dated after today is flagged, not treated as a normal day", () => {
  const diary = shapeDiary(logs, [], [], TODAY);
  const future = diary.days.find((d) => d.date === "2026-09-15");
  assert.equal(future?.isFuture, true);
  assert.equal(diary.days.find((d) => d.date === "2026-09-12")?.isFuture, false);
  assert.equal(diary.totals.futureDatedDays, 1);
  assert.equal(diary.today, TODAY);
});

test("future-dated and voided days stay out of the week's totals", () => {
  const diary = shapeDiary(logs, [], [], TODAY);
  // Only the 12th is a recorded day: the 15th is future, the 11th is voided.
  assert.equal(diary.totals.recordedDays, 1);
  assert.equal(diary.totals.hours, 48);
  assert.match(diary.totals.note, /future-dated and voided days are excluded/);
});

test("each day carries the activities the hours went on", () => {
  const diary = shapeDiary(
    logs,
    [
      { log_date: "2026-09-12", activity_name: "Cut to formation ch 0+000-1+200", hours_logged: "32" },
      { log_date: "2026-09-12", activity_name: "Cart away to approved tip", hours_logged: "16" },
    ],
    [{ log_date: "2026-09-12", author_name: "Tolu O", author_role: "Site Agent", body_text: "Formation to ch 0+800." }],
    TODAY,
  );
  const day = diary.days.find((d) => d.date === "2026-09-12");
  assert.deepEqual(day?.activities, [
    { activity: "Cut to formation ch 0+000-1+200", hours: 32 },
    { activity: "Cart away to approved tip", hours: 16 },
  ]);
  assert.equal(day?.entries[0]?.note, "Formation to ch 0+800.");
  // A day with nothing linked still shapes cleanly rather than going undefined.
  assert.deepEqual(diary.days.find((d) => d.date === "2026-09-15")?.activities, []);
});

test("diaryDates normalises timestamps to the day the reads are keyed by", () => {
  assert.deepEqual(
    diaryDates([{ ...logs[1]!, log_date: new Date("2026-09-12T00:00:00.000Z") }]),
    ["2026-09-12"],
  );
});
