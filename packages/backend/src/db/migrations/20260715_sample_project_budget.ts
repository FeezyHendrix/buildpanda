import type { Knex } from "knex";

const PROJECT_ID = "marbella";

const CATEGORIES = [
  { id: "bc1", name: "Substructure", cost_code: "01-100", planned: 4_445_000, committed: 4_445_000, actual: 4_402_300, sort_order: 0 },
  { id: "bc2", name: "Concrete Frame", cost_code: "03-200", planned: 8_880_000, committed: 8_880_000, actual: 8_888_500, sort_order: 1 },
  { id: "bc3", name: "Roofing & Waterproofing", cost_code: "07-400", planned: 6_500_000, committed: 3_250_000, actual: 1_120_000, sort_order: 2 },
  { id: "bc4", name: "Mechanical & Electrical", cost_code: "15-500", planned: 7_200_000, committed: 2_400_000, actual: 0, sort_order: 3 },
  { id: "bc5", name: "Finishes & Joinery", cost_code: "09-600", planned: 9_500_000, committed: 0, actual: 0, sort_order: 4 },
  { id: "bc6", name: "Preliminaries & Contingency", cost_code: "00-001", planned: 4_775_500, committed: 1_000_000, actual: 420_000, sort_order: 5 },
];

const PERIODS = [
  { id: "bp1", period: "2026-01", planned: 3_500_000, actual: 3_402_300 },
  { id: "bp2", period: "2026-02", planned: 5_000_000, actual: 5_120_000 },
  { id: "bp3", period: "2026-03", planned: 6_500_000, actual: 6_308_500 },
  { id: "bp4", period: "2026-04", planned: 7_000_000, actual: 0 },
  { id: "bp5", period: "2026-05", planned: 8_500_000, actual: 0 },
  { id: "bp6", period: "2026-06", planned: 9_000_000, actual: 0 },
];

export async function up(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;

  const hasCategories = await knex("project_budget_categories")
    .where({ project_id: PROJECT_ID })
    .first();
  if (!hasCategories) {
    await knex("project_budget_categories").insert(
      CATEGORIES.map((c) => ({ ...c, project_id: PROJECT_ID })),
    );
  }

  const hasPeriods = await knex("project_budget_periods")
    .where({ project_id: PROJECT_ID })
    .first();
  if (!hasPeriods) {
    await knex("project_budget_periods").insert(
      PERIODS.map((p) => ({ ...p, project_id: PROJECT_ID })),
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex("project_budget_categories")
    .where({ project_id: PROJECT_ID })
    .whereIn("id", CATEGORIES.map((c) => c.id))
    .del();
  await knex("project_budget_periods")
    .where({ project_id: PROJECT_ID })
    .whereIn("id", PERIODS.map((p) => p.id))
    .del();
}
