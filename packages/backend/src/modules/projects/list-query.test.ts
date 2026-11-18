import assert from "node:assert/strict";
import { test } from "node:test";
import knexFactory from "knex";
import { projectsRepository } from "./repository.ts";

// No database: the pg client is stubbed to record the SQL it would run.
function recordingDb() {
  const db = knexFactory({ client: "pg" });
  const queries: { sql: string; bindings: unknown[] }[] = [];
  const client = db.client as unknown as Record<string, unknown>;
  client["acquireConnection"] = async () => ({});
  client["releaseConnection"] = async () => {};
  client["_query"] = async (_conn: unknown, obj: { sql: string; bindings: unknown[]; response?: unknown }) => {
    queries.push({ sql: obj.sql, bindings: obj.bindings });
    obj.response = { command: "SELECT", rows: [], rowCount: 0 };
    return obj;
  };
  return { db, queries };
}

test("project list searches, filters by created day, sorts with an id tiebreak and pages", async () => {
  const { db, queries } = recordingDb();
  const result = await projectsRepository(db).listForUser(
    "user_1",
    new Map([["org_1", "admin"]]),
    { q: "50%_off", createdFrom: "2026-01-01", createdTo: "2026-01-31", sort: "name_desc" },
    "Africa/Lagos",
    3,
    12,
  );
  assert.deepEqual(result, { rows: [], total: 0 });

  const page = queries.at(-1)!;
  assert.match(page.sql, /"name" ilike \$\d+ or "address" ilike \$\d+/);
  assert.match(page.sql, /order by "name" desc, "id" asc limit \$\d+ offset \$\d+$/);
  // % and _ in the search text are matched literally.
  assert.ok(page.bindings.includes("%50\\%\\_off%"));
  assert.ok(page.bindings.includes("2026-01-01") && page.bindings.includes("2026-01-31"));
  assert.deepEqual(page.bindings.slice(-2), [12, 24]);

  const count = queries.at(-2)!;
  assert.match(count.sql, /^select count\("id"\)/);
  assert.doesNotMatch(count.sql, /limit|order by/);
});

test("project list defaults to recently updated", async () => {
  const { db, queries } = recordingDb();
  await projectsRepository(db).listForUser("user_1", new Map());
  assert.match(queries.at(-1)!.sql, /order by "updated_at" desc, "id" asc/);
});
