import { test } from "node:test";
import assert from "node:assert/strict";
import knexFactory from "knex";
import { agentRepository } from "./repository.ts";
import { workRecordsRepository } from "./work-records.ts";

/**
 * "What changed on culvert 1" answered "I could not find any information"
 * because the agent had one drawing-markup tool and nothing that looks across
 * the records describing work. These assert the sweep covers every one of them
 * and that each term has to be present. Knex builds the statement without
 * connecting, so no database is needed.
 */
const db = knexFactory({ client: "pg" });
const repo = agentRepository(db);
const search = workRecordsRepository(db);

test("the sweep covers activities, delays, RFIs, changes, risks, inspections and orders", () => {
  const kinds = search.workRecordQueries("prj_1", ["culvert 1"]).map((r: { kind: string }) => r.kind);
  assert.deepEqual(kinds, [
    "activity",
    "delay",
    "rfi",
    "change_request",
    "risk",
    "inspection",
    "material_order",
  ]);
});

test("every read is scoped to the project and matched case-insensitively", () => {
  for (const { kind, query } of search.workRecordQueries("prj_1", ["culvert 1"])) {
    const sql = query.toString();
    assert.match(sql, /project_id" = 'prj_1'/, `${kind} is not project-scoped`);
    assert.match(sql, /ILIKE '%culvert 1%'/, `${kind} does not match the term`);
  }
});

test("several terms all have to appear, so a word fallback narrows rather than floods", () => {
  const sql = search.workRecordQueries("prj_1", ["culvert", "1"])[0]!.query.toString();
  assert.match(sql, /ILIKE '%culvert%'/);
  assert.match(sql, /ILIKE '%1%'/);
  assert.match(sql, /and .*ILIKE '%1%'/);
});

test("an empty term list reads nothing rather than returning the whole project", async () => {
  assert.deepEqual(await search.workRecords("prj_1", []), []);
});

test("the diary's day-level reads are batched over the dates, not one query per day", () => {
  const hours = repo.dailyLogActivityHours("prj_1", ["2026-09-12", "2026-09-13"]).toString();
  assert.match(hours, /"dla"\."log_date" in \('2026-09-12', '2026-09-13'\)/);
  const entries = repo.dailyLogEntries("prj_1", ["2026-09-12"]).toString();
  assert.match(entries, /"e"\."log_date" in \('2026-09-12'\)/);
  // A voided entry is not part of the diary.
  assert.match(entries, /"v"\."id" is null/);
});
