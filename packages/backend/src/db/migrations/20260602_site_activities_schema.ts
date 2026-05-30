import type { Knex } from "knex";

const ACTIVITY_STATUSES = ["Planned", "InProgress", "Completed", "Cancelled"] as const;
const CURRENCIES = ["NGN", "USD"] as const;
const WEATHER_CONDITIONS = [
  "Sunny",
  "Cloudy",
  "Rain",
  "Storm",
  "Fog",
  "ExtremeHeat",
] as const;

const DELAY_REASONS: ReadonlyArray<{
  code: string;
  category: string;
  name: string;
  description: string;
}> = [
  { code: "WEATHER_RAIN", category: "Weather", name: "Rain", description: "Heavy rainfall blocked work" },
  { code: "WEATHER_SNOW", category: "Weather", name: "Snow", description: "Snow/ice blocked work" },
  { code: "WEATHER_EXTREME_TEMP", category: "Weather", name: "Extreme Temperature", description: "Heat or cold beyond safe working range" },
  { code: "WEATHER_WIND", category: "Weather", name: "High Winds", description: "Winds prevented crane / scaffold / framing work" },
  { code: "MATERIAL_SHORTAGE", category: "Material", name: "Material Shortage", description: "Required material unavailable on site" },
  { code: "MATERIAL_DELIVERY", category: "Material", name: "Delivery Delay", description: "Material delivery arrived late or not at all" },
  { code: "LABOR_NOSHOW", category: "Labor", name: "Worker No-Show", description: "Crew did not report to site" },
  { code: "LABOR_SHORTAGE", category: "Labor", name: "Crew Shortage", description: "Not enough workers available for the task" },
  { code: "LABOR_ILLNESS", category: "Labor", name: "Illness / Injury", description: "Key personnel out due to illness or on-site injury" },
  { code: "SUBCONTRACTOR_DELAY", category: "Labor", name: "Subcontractor Delay", description: "Specialty subcontractor missed schedule" },
  { code: "EQUIPMENT_BREAKDOWN", category: "Equipment", name: "Equipment Breakdown", description: "Equipment failed during the task" },
  { code: "EQUIPMENT_SHORTAGE", category: "Equipment", name: "Equipment Unavailable", description: "Required equipment was not on site" },
  { code: "APPROVAL_PERMIT", category: "Approval", name: "Permit Delay", description: "Permit not yet issued by authority" },
  { code: "APPROVAL_INSPECTION", category: "Approval", name: "Inspection Hold", description: "Awaiting inspector sign-off" },
  { code: "APPROVAL_CLIENT", category: "Approval", name: "Client Approval", description: "Awaiting decision from client / owner" },
  { code: "DESIGN_CHANGE", category: "Approval", name: "Design Change", description: "Drawings or scope changed mid-task" },
  { code: "SAFETY_ISSUE", category: "Other", name: "Safety Issue", description: "Work paused for a safety concern" },
  { code: "REWORK", category: "Other", name: "Rework", description: "Defective work being redone" },
  { code: "OTHER", category: "Other", name: "Other", description: "Cause not otherwise classified" },
];

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("delay_reasons", (table) => {
    table.text("code").primary();
    table.text("category").notNullable();
    table.text("name").notNullable();
    table.text("description").notNullable();
    table.boolean("is_active").notNullable().defaultTo(true);
  });
  await knex("delay_reasons").insert(DELAY_REASONS);

  await knex.schema.createTable("activities", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("phase_id").references("id").inTable("project_phases").onDelete("SET NULL");
    table.text("name").notNullable();
    table.text("activity_type").notNullable();
    table.text("location");
    table.text("status").notNullable().defaultTo("Planned");
    table.timestamp("planned_start_at", { useTz: true }).notNullable();
    table.timestamp("planned_end_at", { useTz: true }).notNullable();
    table.timestamp("actual_start_at", { useTz: true });
    table.timestamp("actual_end_at", { useTz: true });
    table.integer("worker_count_planned").notNullable().defaultTo(0);
    table.text("notes");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "planned_start_at"]);
    table.index(["phase_id"]);
    table.index(["status"]);
  });
  await knex.raw(`ALTER TABLE activities ADD CONSTRAINT activities_status_check CHECK (status IN (${check(ACTIVITY_STATUSES)}))`);

  await knex.schema.createTable("activity_delays", (table) => {
    table.text("id").primary();
    table.text("activity_id").notNullable().references("id").inTable("activities").onDelete("CASCADE");
    table.text("reason_code").notNullable().references("code").inTable("delay_reasons").onDelete("RESTRICT");
    table.text("description");
    table.timestamp("started_at", { useTz: true }).notNullable();
    table.timestamp("resolved_at", { useTz: true });
    table.decimal("cost_impact", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("prevention_notes");
    table.text("recorded_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["activity_id", "started_at"]);
    table.index(["reason_code"]);
  });
  await knex.raw(`ALTER TABLE activity_delays ADD CONSTRAINT activity_delays_currency_check CHECK (currency IN (${check(CURRENCIES)}))`);

  await knex.schema.createTable("daily_logs", (table) => {
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.date("log_date").notNullable();
    table.primary(["project_id", "log_date"]);
    table.text("weather_condition");
    table.decimal("temperature_c", 5, 2);
    table.decimal("precipitation_mm", 6, 2);
    table.decimal("wind_kph", 5, 2);
    table.integer("workers_expected").notNullable().defaultTo(0);
    table.integer("workers_present").notNullable().defaultTo(0);
    table.decimal("total_hours", 8, 2).notNullable().defaultTo(0);
    table.text("summary");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_weather_check CHECK (weather_condition IS NULL OR weather_condition IN (${check(WEATHER_CONDITIONS)}))`);

  await knex.schema.createTable("daily_log_activities", (table) => {
    table.text("project_id").notNullable();
    table.date("log_date").notNullable();
    table.text("activity_id").notNullable().references("id").inTable("activities").onDelete("CASCADE");
    table.decimal("hours_logged", 6, 2).notNullable().defaultTo(0);
    table.primary(["project_id", "log_date", "activity_id"]);
    table
      .foreign(["project_id", "log_date"])
      .references(["project_id", "log_date"])
      .inTable("daily_logs")
      .onDelete("CASCADE");
  });

  await knex.schema.alterTable("project_updates", (table) => {
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_updates", (table) => {
    table.dropColumn("activity_id");
  });
  await knex.schema.dropTableIfExists("daily_log_activities");
  await knex.schema.dropTableIfExists("daily_logs");
  await knex.schema.dropTableIfExists("activity_delays");
  await knex.schema.dropTableIfExists("activities");
  await knex.schema.dropTableIfExists("delay_reasons");
}
