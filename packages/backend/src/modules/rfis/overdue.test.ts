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

test("the list keyword understands RFI numbers", async () => {
  const { rfiListRepository } = await import("./list-repository.ts");
  // Exercise numberIn through a fake query builder: capture the where callback.
  const captured: unknown[] = [];
  const fakeQ = {
    where() { return this; },
    andWhere(arg: unknown) { if (typeof arg === "function") captured.push(arg); return this; },
    whereIn() { return this; },
    whereNotNull() { return this; },
    clearSelect() { return this; },
    async count() { return [{ count: "0" }]; },
    orderBy() { return this; },
    orderByRaw() { return this; },
    limit() { return this; },
    offset() { return Promise.resolve([]); },
  };
  const repo = rfiListRepository({} as never, { query: () => fakeQ } as never);
  for (const q of ["3", "rfi 3", "RFI-3", "rfi-3 "]) {
    captured.length = 0;
    await repo.search("prj", { q }, false, "2026-11-07", 1, 10);
    const ors: unknown[][] = [];
    const b = {
      whereILike() { return this; },
      orWhereILike() { return this; },
      orWhereRaw() { return this; },
      orWhere(...args: unknown[]) { ors.push(args); return this; },
    };
    (captured[captured.length - 1] as (b: unknown) => void)(b);
    assert.deepEqual(ors, [["r.number", 3]], q);
  }
});
