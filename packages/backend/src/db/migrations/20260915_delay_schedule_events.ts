import type { Knex } from "knex";

/**
 * A delay stops being an open-ended incident and becomes a contractual schedule
 * event: it has a measured duration (`days_lost`), an end, an attributed
 * culpability and an EOT position, and it can point at the RFI / change request
 * / material order that caused it.
 *
 * `applied_shift_days` is the cascade's ledger — the number of working days this
 * delay has ALREADY pushed its activity and successors by. Re-measuring a delay
 * applies only the difference, so logging, amending and reversing a delay are
 * idempotent and the programme never double-counts.
 *
 * Culpability defaults live on the reason (`delay_reasons`), not in code: rain
 * and utility strikes are neutral and EOT-claimable, a client approval is the
 * client's, a late delivery or plant breakdown is the contractor's own risk.
 */

const CULPABILITIES = ["contractor", "client", "neutral"] as const;

const NEW_REASONS: ReadonlyArray<{
  code: string;
  category: string;
  name: string;
  description: string;
  default_culpability: string;
  default_eot_claimable: boolean;
}> = [
  {
    code: "SITE_UNFORESEEN_CONDITIONS",
    category: "Site",
    name: "Unforeseen Conditions",
    description: "Ground or site conditions an experienced contractor could not have foreseen",
    default_culpability: "neutral",
    default_eot_claimable: true,
  },
  {
    code: "SITE_UTILITY_STRIKE",
    category: "Site",
    name: "Utility Strike",
    description: "An unrecorded or mislocated service was struck or had to be diverted",
    default_culpability: "neutral",
    default_eot_claimable: true,
  },
  {
    code: "SITE_THIRD_PARTY",
    category: "Site",
    name: "Third Party",
    description: "Community, authority or other third-party interference stopped work",
    default_culpability: "neutral",
    default_eot_claimable: true,
  },
  {
    code: "APPROVAL_LATE_RFI",
    category: "Approval",
    name: "Late RFI Response",
    description: "An RFI was not answered within the reply period",
    default_culpability: "client",
    default_eot_claimable: true,
  },
  {
    code: "CLIENT_LATE_PAYMENT",
    category: "Approval",
    name: "Late Payment",
    description: "A certified payment was not made by its final date for payment",
    default_culpability: "client",
    default_eot_claimable: true,
  },
];

/** code -> [culpability, eot_claimable] for the reasons seeded before this migration. */
const EXISTING_DEFAULTS: ReadonlyArray<[string, string, boolean]> = [
  ["WEATHER_RAIN", "neutral", true],
  ["WEATHER_SNOW", "neutral", true],
  ["WEATHER_EXTREME_TEMP", "neutral", true],
  ["WEATHER_WIND", "neutral", true],
  ["MATERIAL_SHORTAGE", "contractor", false],
  ["MATERIAL_DELIVERY", "contractor", false],
  ["LABOR_NOSHOW", "contractor", false],
  ["LABOR_SHORTAGE", "contractor", false],
  ["LABOR_ILLNESS", "contractor", false],
  ["SUBCONTRACTOR_DELAY", "contractor", false],
  ["EQUIPMENT_BREAKDOWN", "contractor", false],
  ["EQUIPMENT_SHORTAGE", "contractor", false],
  ["APPROVAL_PERMIT", "client", true],
  ["APPROVAL_INSPECTION", "client", true],
  ["APPROVAL_CLIENT", "client", true],
  ["DESIGN_CHANGE", "client", true],
  ["SAFETY_ISSUE", "neutral", false],
  ["REWORK", "contractor", false],
  ["OTHER", "neutral", false],
];

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("delay_reasons", (table) => {
    table.text("default_culpability").notNullable().defaultTo("neutral");
    table.boolean("default_eot_claimable").notNullable().defaultTo(false);
  });
  await knex.raw(
    `ALTER TABLE delay_reasons ADD CONSTRAINT delay_reasons_culpability_check CHECK (default_culpability IN (${check(CULPABILITIES)}))`,
  );
  for (const [code, culpability, claimable] of EXISTING_DEFAULTS) {
    await knex("delay_reasons")
      .where({ code })
      .update({ default_culpability: culpability, default_eot_claimable: claimable });
  }
  await knex("delay_reasons").insert(NEW_REASONS).onConflict("code").ignore();

  await knex.schema.alterTable("activity_delays", (table) => {
    table.integer("days_lost").notNullable().defaultTo(0);
    table.timestamp("ended_at", { useTz: true });
    table.text("culpability").notNullable().defaultTo("neutral");
    table.boolean("eot_claimable").notNullable().defaultTo(false);
    table.text("linked_rfi_id").references("id").inTable("rfis").onDelete("SET NULL");
    table
      .text("linked_change_request_id")
      .references("id")
      .inTable("change_requests")
      .onDelete("SET NULL");
    table
      .text("linked_material_order_id")
      .references("id")
      .inTable("material_orders")
      .onDelete("SET NULL");
    table.text("resolved_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.integer("applied_shift_days").notNullable().defaultTo(0);
  });
  await knex.raw(
    `ALTER TABLE activity_delays ADD CONSTRAINT activity_delays_culpability_check CHECK (culpability IN (${check(CULPABILITIES)}))`,
  );
  await knex.raw(
    "ALTER TABLE activity_delays ADD CONSTRAINT activity_delays_days_lost_check CHECK (days_lost >= 0)",
  );
  await knex.raw(`
    UPDATE activity_delays d
    SET culpability = r.default_culpability, eot_claimable = r.default_eot_claimable
    FROM delay_reasons r WHERE r.code = d.reason_code
  `);

  // The audit trail a dispute is argued from: who moved the programme, when,
  // by how many days and why.
  await knex.schema.createTable("activity_events", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("activity_id").notNullable().references("id").inTable("activities").onDelete("CASCADE");
    table.text("kind").notNullable();
    table.text("summary").notNullable();
    table.integer("days_delta").notNullable().defaultTo(0);
    table.text("delay_id");
    table.text("actor_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
    table.index(["activity_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("activity_events");

  await knex.raw("ALTER TABLE activity_delays DROP CONSTRAINT IF EXISTS activity_delays_days_lost_check");
  await knex.raw("ALTER TABLE activity_delays DROP CONSTRAINT IF EXISTS activity_delays_culpability_check");
  await knex.schema.alterTable("activity_delays", (table) => {
    table.dropColumn("applied_shift_days");
    table.dropColumn("resolved_by_id");
    table.dropColumn("linked_material_order_id");
    table.dropColumn("linked_change_request_id");
    table.dropColumn("linked_rfi_id");
    table.dropColumn("eot_claimable");
    table.dropColumn("culpability");
    table.dropColumn("ended_at");
    table.dropColumn("days_lost");
  });

  await knex("delay_reasons")
    .whereIn("code", NEW_REASONS.map((r) => r.code))
    .del();
  await knex.raw("ALTER TABLE delay_reasons DROP CONSTRAINT IF EXISTS delay_reasons_culpability_check");
  await knex.schema.alterTable("delay_reasons", (table) => {
    table.dropColumn("default_eot_claimable");
    table.dropColumn("default_culpability");
  });
}
