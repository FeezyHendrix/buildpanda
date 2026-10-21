import assert from "node:assert/strict";
import { test } from "node:test";
import { formatReportTimestamp } from "./report-dates.ts";

// The configured project timezone defaults to Africa/Lagos (UTC+1, no DST):
// a 13:05Z instant is 14:05 on the site's wall clock.

test("a report timestamp reads in the site's timezone, not the server's UTC", () => {
  assert.equal(formatReportTimestamp("2026-10-19T13:05:00.000Z"), "19 Oct 2026, 14:05");
});

test("the calendar date rolls with the timezone across midnight", () => {
  assert.equal(formatReportTimestamp("2026-10-19T23:30:00.000Z"), "20 Oct 2026, 00:30");
});

test("unparseable input passes through untouched", () => {
  assert.equal(formatReportTimestamp("not-a-date"), "not-a-date");
});
