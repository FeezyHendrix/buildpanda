import assert from "node:assert/strict";
import { test } from "node:test";
import { localToday, overdueDays } from "./service.ts";

test("overdue counts whole days past due, only while awaiting an answer", () => {
  const today = "2026-11-07";
  assert.equal(overdueDays({ status: "Open", due_date: "2026-11-05" }, today), 2);
  assert.equal(overdueDays({ status: "InReview", due_date: "2026-11-05T00:00:00.000Z" }, today), 2);
  assert.equal(overdueDays({ status: "Open", due_date: "2026-11-07" }, today), 0);
  assert.equal(overdueDays({ status: "Answered", due_date: "2026-11-01" }, today), 0);
  assert.equal(overdueDays({ status: "Open", due_date: null }, today), 0);
});

test("today follows the project's timezone, not UTC", () => {
  // 23:30 UTC on the 6th is already the 7th in Lagos (UTC+1).
  assert.equal(localToday(new Date("2026-11-06T23:30:00Z"), "Africa/Lagos"), "2026-11-07");
  assert.equal(localToday(new Date("2026-11-06T23:30:00Z"), "UTC"), "2026-11-06");
});
