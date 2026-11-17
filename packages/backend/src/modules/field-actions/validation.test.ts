import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDailyLogCommand } from "./validation.ts";

const target = { projectId: "site", buildingId: "block-a", logDate: "2026-11-14" };

test("daily-log text becomes safe HTML without changing the original command", () => {
  const input = { ...target, kind: "daily_log", payload: { bodyText: "Beam ready\nEight workers <script>alert(1)</script>" } };
  const result = validateDailyLogCommand(input);
  assert.equal(result.kind, "daily_log");
  if (result.kind !== "daily_log") throw new Error("Wrong action");
  assert.match(result.payload.bodyHtml!, /Beam ready<br\s*\/>Eight workers &lt;script&gt;/);
  assert.equal(result.payload.bodyText, input.payload.bodyText);
  assert.ok(!("bodyHtml" in input.payload));
});

test("daily-log rich input removes executable markup and preserves file references", () => {
  const result = validateDailyLogCommand({ ...target, kind: "daily_log", payload: {
    bodyHtml: '<p onclick="bad()">Beam <strong>ready</strong><script>bad()</script></p><img src="/files/photo/download" data-file-id="photo" alt="Beam">',
    bodyText: "Beam ready",
  } });
  if (result.kind !== "daily_log") throw new Error("Wrong action");
  assert.doesNotMatch(result.payload.bodyHtml!, /onclick|<script/);
  assert.match(result.payload.bodyHtml!, /<strong>ready<\/strong>/);
  assert.match(result.payload.bodyHtml!, /data-file-id="photo"/);
});

test("full daily header keeps canonical nulls, zeros and all weather/workforce fields", () => {
  const result = validateDailyLogCommand({ ...target, kind: "update_daily_log", payload: {
    weatherCondition: "Rain", temperatureC: null, precipitationMm: 0, windKph: 12,
    workersExpected: 8, workersPresent: 0, totalHours: 0, summary: null, summaryHtml: null,
  } });
  assert.deepEqual(result.payload, {
    weatherCondition: "Rain", temperatureC: null, precipitationMm: 0, windKph: 12,
    workersExpected: 8, workersPresent: 0, totalHours: 0, summary: null, summaryHtml: null, buildingId: "block-a",
  });
});

test("template responses preserve false, zero and paragraphs", () => {
  const result = validateDailyLogCommand({ ...target, kind: "daily_log", payload: {
    templateId: "diary", responses: { safe: false, workers: 0, notes: "First paragraph\n\nSecond paragraph" },
  } });
  if (result.kind !== "daily_log") throw new Error("Wrong action");
  assert.deepEqual(result.payload.responses, { safe: false, workers: 0, notes: "First paragraph\n\nSecond paragraph" });
});

test("canonical workforce bounds and date/building scope reject invalid reviewed input", () => {
  for (const input of [
    { ...target, kind: "update_daily_log", payload: { workersPresent: 1.5 } },
    { ...target, kind: "update_daily_log", payload: { workersPresent: 5001 } },
    { ...target, kind: "update_daily_log", payload: { totalHours: -1 } },
    { ...target, kind: "update_daily_log", payload: { totalHours: 100001 } },
    { ...target, kind: "update_daily_log", payload: { weatherCondition: "Rainy" } },
    { ...target, kind: "daily_log", logDate: "2026-02-30", payload: { bodyText: "Work" } },
    { ...target, kind: "daily_log", payload: { bodyText: "Work", buildingId: "other" } },
    { ...target, kind: "create_task", payload: { bodyText: "Work" } },
  ]) assert.throws(() => validateDailyLogCommand(input));
});
