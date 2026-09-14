import type { Knex } from "knex";
import { randomUUID } from "node:crypto";

const JOB_PROFILES = ["full_contract", "labour_only", "supply_only"] as const;
const PLAN_DISCIPLINES = ["architectural", "structural", "mep", "civil", "survey", "other"] as const;
const PLAN_REVISION_STATUSES = ["current", "superseded"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

const id = (prefix: string) => `${prefix}_${randomUUID()}`;

interface BoqItemRow {
  id: string;
  proposal_id: string;
  group_label: string;
  description: string;
  description_html: string | null;
  qty: string | number;
  unit: string;
  sort: number;
}

interface TakeoffJobRow {
  id: string;
  proposal_id: string | null;
  file_name: string;
  result: { items?: { trade: string; description: string; quantity: number; unit: string; confidence: string; basis: string }[] } | null;
  created_at: Date;
}

// The proposal BoQ grid is retired: a take-off session is the bill of
// quantities. Existing grid rows become a hand-entered take-off per proposal,
// and each completed DWG job becomes an AI-drafted take-off, so nothing a
// user typed or measured disappears when the grid does. Columns other streams
// add to the precon tables (takeoff_kind, origin) are written only if present.
async function migrateGridRows(knex: Knex): Promise<void> {
  const hasKind = await knex.schema.hasColumn("precon_sessions", "takeoff_kind");
  const hasScope = await knex.schema.hasColumn("precon_sessions", "scope");
  const hasOrigin = await knex.schema.hasColumn("precon_boq_rows", "origin");

  const proposals = await knex("proposals").select("id", "org_id", "title", "created_by");
  const orgByProposal = new Map(proposals.map((p) => [p.id as string, p]));

  const gridRows = (await knex<BoqItemRow>("proposal_boq_items").orderBy(["proposal_id", "sort"])) as BoqItemRow[];
  const byProposal = new Map<string, BoqItemRow[]>();
  for (const row of gridRows) {
    const list = byProposal.get(row.proposal_id) ?? [];
    list.push(row);
    byProposal.set(row.proposal_id, list);
  }

  const sessionBase = (proposalId: string, title: string, kind: string) => {
    const proposal = orgByProposal.get(proposalId);
    if (!proposal) return null;
    const row: Record<string, unknown> = {
      id: id("pcs"),
      org_id: proposal.org_id,
      project_id: null,
      proposal_id: proposalId,
      status: "reviewing",
      title,
      error: null,
      created_by: proposal.created_by ?? null,
    };
    if (hasKind) row["takeoff_kind"] = kind;
    if (hasScope) row["scope"] = JSON.stringify({ kind: "full", elements: [] });
    return row;
  };

  for (const [proposalId, rows] of byProposal) {
    const session = sessionBase(proposalId, "Migrated bill of quantities", "manual");
    if (!session) continue;
    await knex("precon_sessions").insert(session);
    const billId = id("pbl");
    await knex("precon_bills").insert({ id: billId, session_id: session["id"], title: "Migrated bill of quantities", sort: 0 });
    await knex("precon_summary_settings").insert({ session_id: session["id"], prelims_pct: 0, contingency_pct: 0, vat_pct: 7.5 });
    await knex("precon_boq_rows").insert(
      rows.map((r, i) => {
        const line: Record<string, unknown> = {
          id: id("pbr"),
          bill_id: billId,
          sort: i,
          row_type: "item",
          element_group: r.group_label,
          code: null,
          description: r.description,
          unit: r.unit,
          qty_gross: r.qty,
          deductions: JSON.stringify([]),
          qty: r.qty,
          rate: null,
          amount: null,
          rate_source: null,
          confidence: "high",
          status: "verified",
          version: 1,
          measurement_basis: "Migrated from the proposal BoQ grid",
        };
        if (hasOrigin) line["origin"] = "migrated";
        return line;
      }),
    );
  }

  const jobs = (await knex<TakeoffJobRow>("takeoff_jobs")
    .whereNotNull("proposal_id")
    .where({ status: "completed" })
    .orderBy("created_at", "asc")) as TakeoffJobRow[];
  for (const job of jobs) {
    const items = job.result?.items ?? [];
    if (items.length === 0 || !job.proposal_id) continue;
    const session = sessionBase(job.proposal_id, job.file_name, "dwg");
    if (!session) continue;
    await knex("precon_sessions").insert(session);
    const billId = id("pbl");
    await knex("precon_bills").insert({ id: billId, session_id: session["id"], title: `Automated take-off — ${job.file_name}`, sort: 0 });
    await knex("precon_summary_settings").insert({ session_id: session["id"], prelims_pct: 0, contingency_pct: 0, vat_pct: 7.5 });
    await knex("precon_boq_rows").insert(
      items.map((item, i) => {
        const line: Record<string, unknown> = {
          id: id("pbr"),
          bill_id: billId,
          sort: i,
          row_type: "item",
          element_group: item.trade,
          code: null,
          description: item.description,
          unit: item.unit,
          qty_gross: item.quantity,
          deductions: JSON.stringify([]),
          qty: item.quantity,
          rate: null,
          amount: null,
          rate_source: null,
          confidence: item.confidence === "high" ? "high" : "low",
          status: "ai_generated",
          version: 1,
          measurement_basis: item.basis,
        };
        if (hasOrigin) line["origin"] = "ai";
        return line;
      }),
    );
  }
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("proposals", (table) => {
    table.text("job_profile").notNullable().defaultTo("full_contract");
  });
  await knex.raw(
    `ALTER TABLE proposals ADD CONSTRAINT proposals_job_profile_check CHECK (job_profile IN (${check(JOB_PROFILES)}))`,
  );

  await knex.schema.alterTable("proposal_plans", (table) => {
    table.text("sheet_code");
    table.text("discipline");
    table.text("revision");
    table.text("revision_status").notNullable().defaultTo("current");
    table.text("supersedes_plan_id").references("id").inTable("proposal_plans").onDelete("SET NULL");
    table.index(["proposal_id", "sheet_code", "revision_status"], "proposal_plans_sheet_revision_index");
  });
  await knex.raw(
    `ALTER TABLE proposal_plans ADD CONSTRAINT proposal_plans_discipline_check CHECK (discipline IS NULL OR discipline IN (${check(PLAN_DISCIPLINES)}))`,
  );
  await knex.raw(
    `ALTER TABLE proposal_plans ADD CONSTRAINT proposal_plans_revision_status_check CHECK (revision_status IN (${check(PLAN_REVISION_STATUSES)}))`,
  );

  await knex.schema.alterTable("estimate_items", (table) => {
    table.text("takeoff_session_id");
  });

  await migrateGridRows(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("estimate_items", (table) => {
    table.dropColumn("takeoff_session_id");
  });
  await knex.raw("ALTER TABLE proposal_plans DROP CONSTRAINT IF EXISTS proposal_plans_revision_status_check");
  await knex.raw("ALTER TABLE proposal_plans DROP CONSTRAINT IF EXISTS proposal_plans_discipline_check");
  await knex.schema.alterTable("proposal_plans", (table) => {
    table.dropIndex(["proposal_id", "sheet_code", "revision_status"], "proposal_plans_sheet_revision_index");
    table.dropColumn("supersedes_plan_id");
    table.dropColumn("revision_status");
    table.dropColumn("revision");
    table.dropColumn("discipline");
    table.dropColumn("sheet_code");
  });
  await knex.raw("ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_job_profile_check");
  await knex.schema.alterTable("proposals", (table) => {
    table.dropColumn("job_profile");
  });
  // Migrated take-off sessions are left in place: they are user data now.
}
