// The real-database harness the editor's persistence suites run against.
//
// Every claim these suites make — a definition surviving a round-trip, a
// geometry id surviving an edit, a replayed operation returning its first
// receipt, a rolled-back operation leaving nothing behind — is a claim about
// Postgres. A fake or in-memory double cannot make it, so this harness insists
// on a real migrated database and FAILS rather than skipping when none is
// configured: a green suite that silently tested nothing is how the persistence
// contract was wrongly signed off once already.
//
// Point TAKEOFF_TEST_DATABASE_URL at a throwaway migrated database. It must not
// be shared: the fixture creates and deletes an organisation.

import { randomUUID } from "node:crypto";
import knexFactory, { type Knex } from "knex";

export interface EditorFixture {
  orgId: string;
  projectId: string;
  sessionId: string;
  billId: string;
  /** Calibrated so 1 pt = 0.05 m, i.e. 20 pt = 1 m — the plan's fixture sheet. */
  sheetId: string;
  /** A real `user` row: `verified_by` and `edited_by` are foreign keys to it. */
  actor: string;
  /** A second real user, for the checks that another person's edit must block. */
  otherActor: string;
}

/** 50 mm per pt: the plan's calibrated vector sheet, where 20 pt = 1 m. */
export const FIXTURE_MM_PER_PT = 50;

/** Metres → sheet points on the fixture sheet. */
export const m = (metres: number): number => metres * (1000 / FIXTURE_MM_PER_PT);

export function requireTestDatabaseUrl(): string {
  const url = process.env["TAKEOFF_TEST_DATABASE_URL"] ?? "";
  if (!url) {
    throw new Error(
      "TAKEOFF_TEST_DATABASE_URL is not set. These are real-database regressions for the " +
        "take-off editor's persistence contract and must not be skipped. Start the isolated " +
        "cluster (.omo/evidence/takeoff-editor-ux/recovery-persistence-env/db-up.sh) and export " +
        "TAKEOFF_TEST_DATABASE_URL, or run them in CI against a migrated throwaway database.",
    );
  }
  return url;
}

export function connectTestDatabase(): Knex {
  return knexFactory({ client: "pg", connection: requireTestDatabaseUrl(), pool: { min: 1, max: 6 } });
}

/**
 * One organisation, project, session, bill and calibrated sheet. Nothing is
 * measured here: each suite draws what it needs through the real writers, so
 * the row and geometry under test were created the way the product creates them.
 */
export async function seedEditorFixture(db: Knex, label: string): Promise<EditorFixture> {
  const tag = randomUUID().slice(0, 8);
  const fixture: EditorFixture = {
    orgId: `org_${tag}`,
    projectId: `prj_${tag}`,
    sessionId: `pcs_${tag}`,
    billId: `pbl_${tag}`,
    sheetId: `pcsh_${tag}`,
    actor: `usr_${tag}`,
    otherActor: `usr_other_${tag}`,
  };
  await db("user").insert([
    { id: fixture.actor, name: `QS ${tag}`, email: `qs-${tag}@takeoff.qa.local`, emailVerified: true },
    { id: fixture.otherActor, name: `Colleague ${tag}`, email: `peer-${tag}@takeoff.qa.local`, emailVerified: true },
  ]);
  await db("organization").insert({ id: fixture.orgId, name: `${label} ${tag}`, slug: `${label}-${tag}` });
  await db("projects").insert({
    id: fixture.projectId,
    organization_id: fixture.orgId,
    name: `${label} ${tag}`,
    address: "1 Test Street",
    status: "On Track",
    risk: "Low",
    currency: "NGN",
  });
  await db("precon_sessions").insert({
    id: fixture.sessionId,
    project_id: fixture.projectId,
    org_id: fixture.orgId,
    title: `${label} ${tag}`,
    status: "reviewing",
  });
  await db("precon_bills").insert({ id: fixture.billId, session_id: fixture.sessionId, title: "Bill No. 1", sort: 0 });
  await db("precon_sheets").insert({
    id: fixture.sheetId,
    session_id: fixture.sessionId,
    file_name: `${label}.pdf`,
    storage_path: `qa-fixture/${fixture.sheetId}.pdf`,
    page_number: 1,
    code: "QA-01",
    title: "QA plan",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: FIXTURE_MM_PER_PT,
    scale_confidence: 1,
    dim_unit: "mm",
    bounds: JSON.stringify({ width: 760, height: 560 }),
    version: 1,
  });
  return fixture;
}

/**
 * Removes only what this fixture created. The session cascade takes its sheets,
 * bills, rows, geometries and audit entries with it, so a failed test cannot
 * leave rows behind for the next run to trip over.
 */
export async function dropEditorFixture(db: Knex, fixture: EditorFixture): Promise<void> {
  // geometries are ON DELETE RESTRICT against their own parent, so a deduction
  // has to go before the measurement it was cut out of
  await db("precon_geometries")
    .whereIn("sheet_id", db("precon_sheets").select("id").where({ session_id: fixture.sessionId }))
    .whereNotNull("parent_geometry_id")
    .delete();
  await db("precon_sessions").where({ id: fixture.sessionId }).delete();
  await db("projects").where({ id: fixture.projectId }).delete();
  await db("organization").where({ id: fixture.orgId }).delete();
  await db("user").whereIn("id", [fixture.actor, fixture.otherActor]).delete();
}

/** Every audit entry for the session, oldest first — the undo stack's raw material. */
export function auditTrail(db: Knex, sessionId: string): Promise<Record<string, unknown>[]> {
  return db("precon_audit_events").where({ session_id: sessionId }).orderBy("created_at", "asc").select("*");
}
