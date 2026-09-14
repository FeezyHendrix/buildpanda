import { test } from "node:test";
import assert from "node:assert/strict";
import { awardTime, type TimeAwardDeps } from "./time-award.ts";

function build(
  dates: { completion_date: string | null; revised_completion_date: string | null } | undefined,
) {
  const written: Array<string | null> = [];
  const shifted: number[] = [];
  const deps: TimeAwardDeps = {
    dates: async () => dates,
    setRevisedCompletion: async (_projectId, date) => {
      written.push(date);
    },
    shiftContractualKeyDates: async (_projectId, days) => {
      shifted.push(days);
      return 3;
    },
  };
  return { deps, written, shifted };
}

test("an award moves the completion date by calendar days, not working days", async () => {
  const { deps, written, shifted } = build({
    completion_date: "2027-03-25",
    revised_completion_date: null,
  });
  const result = await awardTime("prj_1", 14, deps);
  // 25 Mar + 14 calendar days — a working-day shift would land on 14 Apr.
  assert.equal(result.revisedCompletionDate, "2027-04-08");
  assert.deepEqual(written, ["2027-04-08"]);
  assert.deepEqual(shifted, [14]);
  assert.equal(result.keyDatesMoved, 3);
});

test("a further award compounds on the revised date, not the contract date", async () => {
  const { deps, written } = build({
    completion_date: "2027-03-25",
    revised_completion_date: "2027-04-08",
  });
  const result = await awardTime("prj_1", 3, deps);
  assert.equal(result.revisedCompletionDate, "2027-04-11");
  assert.deepEqual(written, ["2027-04-11"]);
});

test("a negative award gives the time back", async () => {
  const { deps, written, shifted } = build({
    completion_date: "2027-03-25",
    revised_completion_date: "2027-04-08",
  });
  const result = await awardTime("prj_1", -5, deps);
  assert.equal(result.revisedCompletionDate, "2027-04-03");
  assert.deepEqual(written, ["2027-04-03"]);
  assert.deepEqual(shifted, [-5]);
});

test("awarding nothing moves nothing", async () => {
  const { deps, written, shifted } = build({
    completion_date: "2027-03-25",
    revised_completion_date: null,
  });
  const result = await awardTime("prj_1", 0, deps);
  assert.equal(result.revisedCompletionDate, "2027-03-25");
  assert.deepEqual(written, []);
  assert.deepEqual(shifted, []);
});

test("a project with no completion date takes the award without inventing one", async () => {
  const { deps, written, shifted } = build({
    completion_date: null,
    revised_completion_date: null,
  });
  const result = await awardTime("prj_1", 14, deps);
  assert.equal(result.revisedCompletionDate, null);
  assert.deepEqual(written, []);
  // The contractual key dates still move — they are dated even when the
  // project header is not.
  assert.deepEqual(shifted, [14]);
});

test("awarding against a project that does not exist is a 404", async () => {
  const { deps } = build(undefined);
  await assert.rejects(awardTime("prj_missing", 14, deps), /not found/i);
});
