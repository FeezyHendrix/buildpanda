import type { Knex } from "knex";

const OLD_ID = "marbella";
const NEW_ID = "sample-project";

const TABLES_WITH_PROJECT_ID = [
  "action_items",
  "activities",
  "approvals",
  "bim_models",
  "boq_import_jobs",
  "budget_phases",
  "change_requests",
  "channels",
  "daily_log_activities",
  "daily_logs",
  "equipment_requests",
  "file_shares",
  "import_sessions",
  "inspections",
  "key_dates",
  "material_ledger_entries",
  "material_ledger_entry_events",
  "material_orders",
  "material_procurements",
  "materials_catalog",
  "materials_stock",
  "milestone_payments",
  "notifications",
  "payment_ledger",
  "permits",
  "programme_cost_phasing",
  "project_ai_insights",
  "project_budget_categories",
  "project_budget_periods",
  "project_documents",
  "project_file_import_jobs",
  "project_finances",
  "project_invoices",
  "project_participants",
  "project_phases",
  "project_updates",
  "proposals",
  "queries",
  "rfi_counters",
  "rfis",
  "risk_factors",
  "task_boards",
  "task_links",
  "tasks",
  "team_members",
];

async function renameProjectId(knex: Knex, from: string, to: string): Promise<void> {
  const source = await knex("projects").where({ id: from }).first();
  if (!source) return;
  const existingTarget = await knex("projects").where({ id: to }).first();
  if (existingTarget) return;

  await knex.transaction(async (trx) => {
    // Disable FK triggers for this transaction so the id can be rewritten across
    // the parent and every descendant (some are linked by composite keys that
    // include project_id, e.g. daily_log_activities) without ordering issues.
    await trx.raw("SET session_replication_role = replica");
    try {
      await trx("projects").where({ id: from }).update({ id: to });
      for (const table of TABLES_WITH_PROJECT_ID) {
        await trx(table).where({ project_id: from }).update({ project_id: to });
      }
      await trx("programme_import_jobs")
        .where({ created_project_id: from })
        .update({ created_project_id: to });
    } finally {
      await trx.raw("SET session_replication_role = origin");
    }
  });
}

export async function up(knex: Knex): Promise<void> {
  await renameProjectId(knex, OLD_ID, NEW_ID);
}

export async function down(knex: Knex): Promise<void> {
  await renameProjectId(knex, NEW_ID, OLD_ID);
}
