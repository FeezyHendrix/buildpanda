import type { Knex } from "knex";

const PROPOSAL_STATUS = [
  "New", "Preparing", "Sent", "UnderReview", "Revising",
  "Accepted", "Converted", "Lost", "Expired",
] as const;

const ESTIMATE_STATUS = [
  "Draft", "Sent", "Accepted", "Declined", "Superseded", "Expired",
] as const;

const COLLABORATOR_ROLE = ["homeowner", "architect"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("proposals", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    table.text("project_id").references("id").inTable("projects").onDelete("SET NULL");
    table.integer("number").notNullable();
    table.text("title").notNullable();
    table.text("client_name").notNullable();
    table.text("client_email");
    table.text("client_phone");
    table.text("location");
    table.text("brief");
    table.text("status").notNullable().defaultTo("New");
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("valid_until");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["org_id", "number"]);
    table.index(["org_id", "status"]);
  });
  await knex.raw(
    `ALTER TABLE proposals ADD CONSTRAINT proposals_status_check CHECK (status IN (${check(PROPOSAL_STATUS)}))`,
  );

  await knex.schema.createTable("proposal_collaborators", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("email").notNullable();
    table.text("role").notNullable().defaultTo("homeowner");
    table.text("invite_token");
    table.text("invite_expires_at");
    table.text("user_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["proposal_id", "email"]);
    table.index(["proposal_id"]);
    table.index(["invite_token"]);
  });
  await knex.raw(
    `ALTER TABLE proposal_collaborators ADD CONSTRAINT proposal_collaborators_role_check CHECK (role IN (${check(COLLABORATOR_ROLE)}))`,
  );

  await knex.schema.createTable("proposal_events", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("actor");
    table.jsonb("metadata");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["proposal_id", "created_at"]);
  });

  await knex.schema.createTable("proposal_comments", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.text("author_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["proposal_id", "created_at"]);
  });

  await knex.schema.createTable("estimates", (table) => {
    table.text("id").primary();
    table.text("proposal_id").notNullable().references("id").inTable("proposals").onDelete("CASCADE");
    table.integer("revision_no").notNullable().defaultTo(1);
    table.text("status").notNullable().defaultTo("Draft");
    table.decimal("contingency_pct", 5, 2).notNullable().defaultTo(0);
    table.text("tax_label").defaultTo("VAT");
    table.decimal("tax_pct", 5, 2).notNullable().defaultTo(0);
    table.text("change_note");
    table.decimal("subtotal", 16, 2).notNullable().defaultTo(0);
    table.decimal("tax_amount", 16, 2).notNullable().defaultTo(0);
    table.decimal("total", 16, 2).notNullable().defaultTo(0);
    table.text("share_token");
    table.text("share_token_expires_at");
    table.timestamp("sent_at", { useTz: true });
    table.timestamp("accepted_at", { useTz: true });
    table.text("accepted_by_name");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["proposal_id", "revision_no"]);
    table.index(["share_token"]);
  });
  await knex.raw(
    `ALTER TABLE estimates ADD CONSTRAINT estimates_status_check CHECK (status IN (${check(ESTIMATE_STATUS)}))`,
  );

  await knex.schema.createTable("estimate_items", (table) => {
    table.text("id").primary();
    table.text("estimate_id").notNullable().references("id").inTable("estimates").onDelete("CASCADE");
    table.text("group_label").notNullable().defaultTo("General");
    table.text("description").notNullable();
    table.decimal("qty", 12, 3).notNullable().defaultTo(1);
    table.text("unit").notNullable().defaultTo("item");
    table.decimal("unit_rate", 16, 2).notNullable().defaultTo(0);
    table.decimal("total", 16, 2).notNullable().defaultTo(0);
    table.text("boq_item_id");
    table.integer("sort").notNullable().defaultTo(0);
    table.index(["estimate_id", "sort"]);
  });

  await knex.schema.createTable("estimate_payment_schedule", (table) => {
    table.text("id").primary();
    table.text("estimate_id").notNullable().references("id").inTable("estimates").onDelete("CASCADE");
    table.text("label").notNullable();
    table.decimal("percent", 5, 2).notNullable();
    table.text("description");
    table.integer("sort").notNullable().defaultTo(0);
    table.index(["estimate_id", "sort"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("estimate_payment_schedule");
  await knex.schema.dropTableIfExists("estimate_items");
  await knex.schema.dropTableIfExists("estimates");
  await knex.schema.dropTableIfExists("proposal_comments");
  await knex.schema.dropTableIfExists("proposal_events");
  await knex.schema.dropTableIfExists("proposal_collaborators");
  await knex.schema.dropTableIfExists("proposals");
}
