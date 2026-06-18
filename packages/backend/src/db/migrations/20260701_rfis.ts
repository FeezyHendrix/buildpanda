import type { Knex } from "knex";

const STATUS = ["Draft", "Open", "InReview", "Answered", "Closed", "Void"] as const;
const PRIORITY = ["Low", "Normal", "High"] as const;
const VISIBILITY = ["internal", "shared"] as const;
const LINK_TARGET = ["document", "bim_object", "change_request"] as const;
const DISTRIBUTION_ROLE = ["responder", "viewer"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("rfi_counters", (table) => {
    table.text("project_id").primary().references("id").inTable("projects").onDelete("CASCADE");
    table.integer("next_number").notNullable().defaultTo(1);
  });

  await knex.schema.createTable("rfis", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.integer("number").notNullable();
    table.text("subject").notNullable();
    table.text("question").notNullable();
    table.text("status").notNullable().defaultTo("Draft");
    table.text("priority").notNullable().defaultTo("Normal");
    table.text("visibility").notNullable().defaultTo("internal");
    table.text("ball_in_court_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("assignee_role");
    table.date("due_date");
    table.text("official_response");
    table.text("official_responded_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("official_responded_at", { useTz: true });
    table.boolean("cost_impact").notNullable().defaultTo(false);
    table.boolean("schedule_impact").notNullable().defaultTo(false);
    table.text("change_request_id").references("id").inTable("change_requests").onDelete("SET NULL");
    table.integer("reopened_count").notNullable().defaultTo(0);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.date("last_reminded_on");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["project_id", "number"]);
    table.index(["project_id", "status"]);
    table.index(["project_id", "ball_in_court_id"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE rfis ADD CONSTRAINT rfis_status_check CHECK (status IN (${check(STATUS)}))`,
  );
  await knex.raw(
    `ALTER TABLE rfis ADD CONSTRAINT rfis_priority_check CHECK (priority IN (${check(PRIORITY)}))`,
  );
  await knex.raw(
    `ALTER TABLE rfis ADD CONSTRAINT rfis_visibility_check CHECK (visibility IN (${check(VISIBILITY)}))`,
  );

  await knex.schema.createTable("rfi_comments", (table) => {
    table.text("id").primary();
    table.text("rfi_id").notNullable().references("id").inTable("rfis").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.boolean("is_proposed_response").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rfi_id", "created_at"]);
  });

  await knex.schema.createTable("rfi_links", (table) => {
    table.text("id").primary();
    table.text("rfi_id").notNullable().references("id").inTable("rfis").onDelete("CASCADE");
    table.text("target_type").notNullable();
    table.text("target_id").notNullable();
    table.text("target_model_id");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rfi_id"]);
  });
  await knex.raw(
    `ALTER TABLE rfi_links ADD CONSTRAINT rfi_links_target_type_check CHECK (target_type IN (${check(LINK_TARGET)}))`,
  );

  await knex.schema.createTable("rfi_distribution", (table) => {
    table.text("id").primary();
    table.text("rfi_id").notNullable().references("id").inTable("rfis").onDelete("CASCADE");
    table.text("user_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("email");
    table.text("name");
    table.text("role").notNullable().defaultTo("viewer");
    table.text("reply_token_hash");
    table.timestamp("token_expires_at", { useTz: true });
    table.timestamp("token_consumed_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rfi_id"]);
    table.index(["reply_token_hash"]);
  });
  await knex.raw(
    `ALTER TABLE rfi_distribution ADD CONSTRAINT rfi_distribution_role_check CHECK (role IN (${check(DISTRIBUTION_ROLE)}))`,
  );

  await knex.schema.createTable("rfi_events", (table) => {
    table.text("id").primary();
    table.text("rfi_id").notNullable().references("id").inTable("rfis").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("actor_id");
    table.text("actor_label");
    table.jsonb("detail");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["rfi_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("rfi_events");
  await knex.schema.dropTableIfExists("rfi_distribution");
  await knex.schema.dropTableIfExists("rfi_links");
  await knex.schema.dropTableIfExists("rfi_comments");
  await knex.schema.dropTableIfExists("rfis");
  await knex.schema.dropTableIfExists("rfi_counters");
}
