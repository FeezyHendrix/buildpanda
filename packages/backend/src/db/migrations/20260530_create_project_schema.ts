import type { Knex } from "knex";

const TONE_VALUES = ["brand", "orange", "green", "purple", "amber", "red", "gray"] as const;
const PROJECT_STATUS = ["On Track", "At Risk", "Delayed"] as const;
const RISK_LEVELS = ["Low", "Medium", "High"] as const;
const PHASE_STATUS = ["Done", "InProgress", "Pending"] as const;
const CURRENCIES = ["NGN", "USD"] as const;
const UPDATE_CATEGORIES = ["Progress", "Material Delivery", "Inspections", "Issues"] as const;
const CTA_TONES = ["primary", "secondary"] as const;
const MEDIA_TYPES = ["photo", "video"] as const;
const DOC_STATUSES = ["Verified", "Pending", "Expired"] as const;
const INSPECTION_CATEGORIES = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
] as const;
const INSPECTION_STATUSES = ["Action Required", "Completed", "Scheduled"] as const;
const MILESTONE_STATUSES = ["Completed", "InProgress", "Pending"] as const;
const SIGN_OFF_VALUES = ["Verified", "Scheduled", "Pending"] as const;
const LEDGER_TYPES = ["Release", "Deposit", "Hold"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("projects", (table) => {
    table.text("id").primary();
    table.text("owner_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("name").notNullable();
    table.text("address").notNullable();
    table.text("status").notNullable();
    table.integer("health_score").notNullable().defaultTo(0);
    table.text("risk").notNullable();
    table.integer("progress_percent").notNullable().defaultTo(0);
    table.decimal("budget_total", 14, 2).notNullable().defaultTo(0);
    table.decimal("budget_used", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable();
    table.integer("pending_approvals").notNullable().defaultTo(0);
    table.text("next_inspection_type");
    table.text("next_inspection_date");
    table.text("folder_tone").notNullable().defaultTo("orange");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN (${check(PROJECT_STATUS)}))`);
  await knex.raw(`ALTER TABLE projects ADD CONSTRAINT projects_risk_check CHECK (risk IN (${check(RISK_LEVELS)}))`);
  await knex.raw(`ALTER TABLE projects ADD CONSTRAINT projects_currency_check CHECK (currency IN (${check(CURRENCIES)}))`);
  await knex.raw(`ALTER TABLE projects ADD CONSTRAINT projects_folder_tone_check CHECK (folder_tone IN (${check(TONE_VALUES)}))`);

  await knex.schema.createTable("project_phases", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("status").notNullable();
    table.text("date_range");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE project_phases ADD CONSTRAINT project_phases_status_check CHECK (status IN (${check(PHASE_STATUS)}))`);

  await knex.schema.createTable("project_updates", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("author_role").notNullable();
    table.text("author_initials_tone").notNullable().defaultTo("brand");
    table.text("author_avatar_url");
    table.text("category").notNullable();
    table.text("title").notNullable();
    table.text("description").notNullable();
    table.text("cta_label").notNullable();
    table.text("cta_tone").notNullable();
    table.text("secondary_action_label");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE project_updates ADD CONSTRAINT project_updates_category_check CHECK (category IN (${check(UPDATE_CATEGORIES)}))`);
  await knex.raw(`ALTER TABLE project_updates ADD CONSTRAINT project_updates_cta_tone_check CHECK (cta_tone IN (${check(CTA_TONES)}))`);

  await knex.schema.createTable("update_media", (table) => {
    table.text("id").primary();
    table.text("update_id").notNullable().references("id").inTable("project_updates").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("url").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["update_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE update_media ADD CONSTRAINT update_media_type_check CHECK (type IN (${check(MEDIA_TYPES)}))`);

  await knex.schema.createTable("document_categories", (table) => {
    table.text("id").primary();
    table.text("name").notNullable().unique();
    table.text("tone").notNullable().defaultTo("brand");
  });
  await knex.raw(`ALTER TABLE document_categories ADD CONSTRAINT document_categories_tone_check CHECK (tone IN (${check(TONE_VALUES)}))`);

  await knex.schema.createTable("project_documents", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("category_id").references("id").inTable("document_categories").onDelete("SET NULL");
    table.text("file_name").notNullable();
    table.text("size").notNullable();
    table.text("status").notNullable();
    table.text("uploaded_at").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE project_documents ADD CONSTRAINT project_documents_status_check CHECK (status IN (${check(DOC_STATUSES)}))`);

  await knex.schema.createTable("inspections", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("inspector_id").notNullable();
    table.text("inspector_name").notNullable();
    table.text("inspector_role").notNullable();
    table.text("inspector_initials_tone").notNullable().defaultTo("brand");
    table.text("inspector_avatar_url");
    table.text("title").notNullable();
    table.text("category").notNullable();
    table.text("description").notNullable();
    table.text("status").notNullable();
    table.text("risk_level").notNullable();
    table.text("scheduled_at").notNullable();
    table.text("report_url");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE inspections ADD CONSTRAINT inspections_category_check CHECK (category IN (${check(INSPECTION_CATEGORIES)}))`);
  await knex.raw(`ALTER TABLE inspections ADD CONSTRAINT inspections_status_check CHECK (status IN (${check(INSPECTION_STATUSES)}))`);
  await knex.raw(`ALTER TABLE inspections ADD CONSTRAINT inspections_risk_check CHECK (risk_level IN (${check(RISK_LEVELS)}))`);

  await knex.schema.createTable("inspection_media", (table) => {
    table.text("id").primary();
    table.text("inspection_id").notNullable().references("id").inTable("inspections").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("url").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["inspection_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE inspection_media ADD CONSTRAINT inspection_media_type_check CHECK (type IN (${check(MEDIA_TYPES)}))`);

  await knex.schema.createTable("project_finances", (table) => {
    table.text("project_id").primary().references("id").inTable("projects").onDelete("CASCADE");
    table.text("currency").notNullable();
    table.decimal("total_budget", 14, 2).notNullable().defaultTo(0);
    table.decimal("funds_deposited", 14, 2).notNullable().defaultTo(0);
    table.decimal("funds_released", 14, 2).notNullable().defaultTo(0);
    table.decimal("locked_in_escrow", 14, 2).notNullable().defaultTo(0);
    table.decimal("remaining_balance", 14, 2).notNullable().defaultTo(0);
  });
  await knex.raw(`ALTER TABLE project_finances ADD CONSTRAINT project_finances_currency_check CHECK (currency IN (${check(CURRENCIES)}))`);

  await knex.schema.createTable("budget_phases", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.decimal("planned", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual", 14, 2).notNullable().defaultTo(0);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
  });

  await knex.schema.createTable("material_procurements", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("purchased_at").notNullable();
    table.text("receipt").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.text("thumbnail_tone").notNullable().defaultTo("brand");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE material_procurements ADD CONSTRAINT material_procurements_tone_check CHECK (thumbnail_tone IN (${check(TONE_VALUES)}))`);

  await knex.schema.createTable("milestone_payments", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("phase").notNullable();
    table.text("status").notNullable();
    table.integer("percent_complete").notNullable().defaultTo(0);
    table.decimal("amount", 14, 2).notNullable().defaultTo(0);
    table.text("proof_file_name");
    table.boolean("proof_verified").notNullable().defaultTo(false);
    table.text("inspector_sign_off").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE milestone_payments ADD CONSTRAINT milestone_payments_status_check CHECK (status IN (${check(MILESTONE_STATUSES)}))`);
  await knex.raw(`ALTER TABLE milestone_payments ADD CONSTRAINT milestone_payments_sign_off_check CHECK (inspector_sign_off IN (${check(SIGN_OFF_VALUES)}))`);

  await knex.schema.createTable("payment_ledger", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("entry_date").notNullable();
    table.text("description").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.text("type").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(`ALTER TABLE payment_ledger ADD CONSTRAINT payment_ledger_type_check CHECK (type IN (${check(LEDGER_TYPES)}))`);

  await knex.schema.createTable("risk_factors", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description").notNullable();
    table.text("severity").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(`ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_severity_check CHECK (severity IN (${check(RISK_LEVELS)}))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("risk_factors");
  await knex.schema.dropTableIfExists("payment_ledger");
  await knex.schema.dropTableIfExists("milestone_payments");
  await knex.schema.dropTableIfExists("material_procurements");
  await knex.schema.dropTableIfExists("budget_phases");
  await knex.schema.dropTableIfExists("project_finances");
  await knex.schema.dropTableIfExists("inspection_media");
  await knex.schema.dropTableIfExists("inspections");
  await knex.schema.dropTableIfExists("project_documents");
  await knex.schema.dropTableIfExists("document_categories");
  await knex.schema.dropTableIfExists("update_media");
  await knex.schema.dropTableIfExists("project_updates");
  await knex.schema.dropTableIfExists("project_phases");
  await knex.schema.dropTableIfExists("projects");
}
