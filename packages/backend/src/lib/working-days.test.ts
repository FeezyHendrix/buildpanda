import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  addWorkingDays,
  countWorkingDays,
  DEFAULT_CALENDAR,
  isWorkingDay,
  toCalendar,
  workingDatesBetween,
  type WorkingCalendar,
} from "./working-days.ts";

const MON_FRI: WorkingCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: [] };
// 2026-09-07 is a Monday.
const MON = "2026-09-07T07:00:00.000Z";

test("a Mon–Fri span is 5 working days, not 4", () => {
  assert.equal(countWorkingDays(MON, "2026-09-11T17:00:00.000Z", MON_FRI), 5);
});

test("the six-day site week counts Saturday", () => {
  assert.equal(countWorkingDays(MON, "2026-09-12T17:00:00.000Z", DEFAULT_CALENDAR), 6);
  assert.equal(countWorkingDays(MON, "2026-09-12T17:00:00.000Z", MON_FRI), 5);
});

test("holidays are not working days", () => {
  const withHoliday: WorkingCalendar = { workingDays: [1, 2, 3, 4, 5], holidays: ["2026-09-09"] };
  assert.equal(countWorkingDays(MON, "2026-09-11T17:00:00.000Z", withHoliday), 4);
  assert.equal(isWorkingDay("2026-09-09T09:00:00.000Z", withHoliday), false);
});

test("an end before the start counts nothing", () => {
  assert.equal(countWorkingDays("2026-09-11T00:00:00.000Z", MON, MON_FRI), 0);
});

test("adding working days skips the weekend and keeps the time of day", () => {
  // Friday + 1 working day on a Mon–Fri week lands on Monday at the same hour.
  const result = addWorkingDays("2026-09-11T07:00:00.000Z", 1, MON_FRI);
  assert.equal(result, "2026-09-14T07:00:00.000Z");
});

test("adding working days on a six-day week lands on Saturday", () => {
  assert.equal(addWorkingDays("2026-09-11T07:00:00.000Z", 1, DEFAULT_CALENDAR), "2026-09-12T07:00:00.000Z");
});

test("a zero shift leaves the instant untouched — a no-op cascade changes nothing", () => {
  assert.equal(addWorkingDays(MON, 0, MON_FRI), MON);
});

test("a negative shift walks back over working days (the cascade is reversible)", () => {
  const forward = addWorkingDays(MON, 6, MON_FRI);
  assert.equal(addWorkingDays(forward, -6, MON_FRI), MON);
});

test("an empty or nonsense calendar falls back to the six-day week", () => {
  assert.deepEqual(toCalendar([], null).workingDays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(toCalendar("not json", "nope").workingDays, [1, 2, 3, 4, 5, 6]);
});

test("the json columns parse from strings or arrays", () => {
  const calendar = toCalendar("[1,2,3]", '["2026-10-01","junk"]');
  assert.deepEqual(calendar.workingDays, [1, 2, 3]);
  assert.deepEqual(calendar.holidays, ["2026-10-01"]);
});

test("working dates between lists only the days the site works", () => {
  const dates = workingDatesBetween(MON, "2026-09-13T00:00:00.000Z", MON_FRI);
  assert.deepEqual(dates, [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
  ]);
});

test("calendar days ignore the working week — an EOT extends the contract, not the roster", () => {
  assert.equal(addCalendarDays("2026-03-26T00:00:00.000Z", 14), "2026-04-09T00:00:00.000Z");
});
