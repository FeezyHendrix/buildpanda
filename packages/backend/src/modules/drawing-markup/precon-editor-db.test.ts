import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import knexFactory, { type Knex } from "knex";
import { preconAuditRepository } from "../panda-ai/pdf-takeoff/audit-repository.ts";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import { drawingMarkupRepository } from "./repository.ts";
import { drawingMarkupService } from "./service.ts";

// Withdrawing a redline is a soft delete, so the claim worth proving is about
// *readers*: the sheet must stop showing the pin the moment it is withdrawn and
// show it again when that is undone. These are claims about SQL, so point
// TAKEOFF_TEST_DATABASE_URL at a throwaway migrated database to run them — it
// must not be a shared one, the fixture creates and deletes an organisation.

const TEST_DATABASE_URL = process.env["TAKEOFF_TEST_DATABASE_URL"] ?? "";
const NEEDS_DB = TEST_DATABASE_URL
  ? undefined
  : "requires isolated DB — set TAKEOFF_TEST_DATABASE_URL to a throwaway migrated database";

interface Fixture {
  orgId: string;
  projectId: string;
  sessionId: string;
  sheetId: string;
  markupId: string;
  actorId: string;
}

let db: Knex | null = null;
let fixture: Fixture | null = null;

function database(): Knex {
  assert.ok(db, "the database fixture is only available when TAKEOFF_TEST_DATABASE_URL is set");
  return db;
}

function seeded(): Fixture {
  assert.ok(fixture, "the seeded fixture is only available when TAKEOFF_TEST_DATABASE_URL is set");
  return fixture;
}

async function seed(connection: Knex): Promise<Fixture> {
  const tag = randomUUID().slice(0, 8);
  const ids: Fixture = {
    orgId: `org_${tag}`,
    projectId: `prj_${tag}`,
    sessionId: `pcs_${tag}`,
    sheetId: `psh_${tag}`,
    markupId: `mk_${tag}`,
    actorId: `usr_${tag}`,
  };
  await connection("user").insert({
    id: ids.actorId,
    name: `Markup E2E ${tag}`,
    email: `markup-e2e-${tag}@example.test`,
    emailVerified: true,
  });
  await connection("organization").insert({
    id: ids.orgId,
    name: `Markup E2E ${tag}`,
    slug: `markup-e2e-${tag}`,
  });
  await connection("projects").insert({
    id: ids.projectId,
    organization_id: ids.orgId,
    name: `Markup E2E ${tag}`,
    address: "1 Test Street",
    status: "On Track",
    risk: "Low",
    currency: "NGN",
  });
  await connection("precon_sessions").insert({
    id: ids.sessionId,
    project_id: ids.projectId,
    org_id: ids.orgId,
    title: `Markup E2E ${tag}`,
    status: "reviewing",
  });
  await connection("precon_sheets").insert({
    id: ids.sheetId,
    session_id: ids.sessionId,
    file_name: "plan.pdf",
    storage_path: `precon/${tag}/plan.pdf`,
    page_number: 1,
  });
  await connection("drawing_markups").insert({
    id: ids.markupId,
    precon_session_id: ids.sessionId,
    precon_sheet_id: ids.sheetId,
    kind: "pin",
    geometry: JSON.stringify({ kind: "pin", at: { x: 10, y: 20 }, space: "points" }),
    color: "#004DE7",
    version: 1,
  });
  return ids;
}

before(async () => {
  if (!TEST_DATABASE_URL) return;
  db = knexFactory({ client: "pg", connection: TEST_DATABASE_URL, pool: { min: 1, max: 4 } });
  fixture = await seed(db);
});

after(async () => {
  if (!db) return;
  if (fixture) {
    await db("drawing_markups").where({ id: fixture.markupId }).delete();
    await db("precon_sessions").where({ id: fixture.sessionId }).delete();
    await db("projects").where({ id: fixture.projectId }).delete();
    await db("organization").where({ id: fixture.orgId }).delete();
    await db("user").where({ id: fixture.actorId }).delete();
  }
  await db.destroy();
  db = null;
});

test("listBySession excludes deleted markups", { skip: NEEDS_DB }, async () => {
  const repo = drawingMarkupRepository(database());
  const { sessionId, markupId } = seeded();

  const onSheet = await repo.listBySession(sessionId);
  assert.ok(onSheet.some((m) => m.id === markupId), "the pin is on the sheet before it is withdrawn");

  const withdrawn = await repo.softDeleteMarkup(markupId, new Date(), 1);
  assert.ok(withdrawn, "the withdrawal wins against the version it quoted");
  try {
    const during = await repo.listBySession(sessionId);
    assert.equal(during.some((m) => m.id === markupId), false, "a withdrawn pin is off the sheet");

    const forUndo = await repo.listBySessionIncludeDeleted(sessionId);
    assert.ok(forUndo.some((m) => m.id === markupId), "it is still on the record, offerable back");
  } finally {
    await repo.restoreMarkup(markupId, 2);
  }

  const restored = await repo.listBySession(sessionId);
  assert.ok(restored.some((m) => m.id === markupId), "restoring puts the pin back on the sheet");
});

// A stroke drawn at 4 px in red is ONE gesture. It used to land as two records —
// the create, which could only carry a colour, and an `edit-markup` right after
// it to state the width the pen already had. That reads back as somebody having
// changed their mind about a redline seconds after drawing it, which on a
// contractual record is a different event from drawing it that way.
test("a stroke is created with the pen it was drawn with, in one record", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, sheetId, orgId, actorId } = seeded();
  const service = drawingMarkupService(
    drawingMarkupRepository(connection),
    preconService(preconRepository(connection), () => {}),
    preconAuditRepository(connection),
  );

  const created = await service.createForSession(sessionId, orgId, actorId, {
    sheetId,
    kind: "pen",
    geometry: { kind: "pen", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], space: "points" },
    color: "#D92D20",
    style: { color: "#D92D20", strokeWidthPx: 4 },
  });

  try {
    assert.equal(created.version, 1, "one gesture, one version: nothing was restated after it");
    assert.deepEqual(created.style, { color: "#D92D20", strokeWidthPx: 4 }, "the pen is on the record it was drawn with");

    const stored = await connection("drawing_markups").where({ id: created.id }).first();
    assert.deepEqual(stored?.["style"], { color: "#D92D20", strokeWidthPx: 4 }, "persisted, not just echoed back");

    const onSheet = (await drawingMarkupRepository(connection).listBySession(sessionId)).find((m) => m.id === created.id);
    assert.deepEqual(onSheet?.style, { color: "#D92D20", strokeWidthPx: 4 }, "and it redraws as it was drawn after a reload");
  } finally {
    await connection("drawing_markups").where({ id: created.id }).delete();
  }
});

test("a pin drawn with no pen states none, rather than inventing one", { skip: NEEDS_DB }, async () => {
  const connection = database();
  const { sessionId, sheetId, orgId, actorId } = seeded();
  const service = drawingMarkupService(
    drawingMarkupRepository(connection),
    preconService(preconRepository(connection), () => {}),
    preconAuditRepository(connection),
  );

  const created = await service.createForSession(sessionId, orgId, actorId, {
    sheetId,
    kind: "pin",
    geometry: { kind: "pin", at: { x: 5, y: 5 }, space: "points" },
  });

  try {
    assert.equal(created.style, null);
  } finally {
    await connection("drawing_markups").where({ id: created.id }).delete();
  }
});
