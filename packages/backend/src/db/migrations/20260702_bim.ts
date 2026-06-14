import type { Knex } from "knex";

const VERSION_STATUS = ["Processing", "Ready", "Failed"] as const;
const ISSUE_STATUS = ["Open", "Closed"] as const;
const LINK_TYPE = ["phase", "activity", "change_request", "cost_item"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("bim_models", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("discipline");
    table.text("current_version_id");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id"]);
  });

  await knex.schema.createTable("bim_model_versions", (table) => {
    table.text("id").primary();
    table.text("bim_model_id").notNullable().references("id").inTable("bim_models").onDelete("CASCADE");
    table.integer("version").notNullable();
    table.text("source_storage_path").notNullable();
    table.text("source_file_name").notNullable();
    table.text("status").notNullable().defaultTo("Processing");
    table.text("failure_reason");
    table.bigInteger("size_bytes");
    table.integer("element_count");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["bim_model_id", "version"]);
    table.index(["bim_model_id"]);
  });
  await knex.raw(
    `ALTER TABLE bim_model_versions ADD CONSTRAINT bim_model_versions_status_check CHECK (status IN (${check(VERSION_STATUS)}))`,
  );

  await knex.schema.createTable("bim_elements", (table) => {
    table.text("id").primary();
    table
      .text("model_version_id")
      .notNullable()
      .references("id")
      .inTable("bim_model_versions")
      .onDelete("CASCADE");
    table.text("guid").notNullable();
    table.integer("express_id");
    table.text("ifc_type");
    table.text("name");
    table.index(["model_version_id", "guid"]);
  });

  await knex.schema.createTable("bim_coordination_issues", (table) => {
    table.text("id").primary();
    table.text("bim_model_id").notNullable().references("id").inTable("bim_models").onDelete("CASCADE");
    table.text("element_guid");
    table.jsonb("position");
    table.text("title").notNullable();
    table.text("description");
    table.text("status").notNullable().defaultTo("Open");
    table.text("rfi_id").references("id").inTable("rfis").onDelete("SET NULL");
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["bim_model_id", "status"]);
  });
  await knex.raw(
    `ALTER TABLE bim_coordination_issues ADD CONSTRAINT bim_coordination_issues_status_check CHECK (status IN (${check(ISSUE_STATUS)}))`,
  );

  await knex.schema.createTable("bim_element_links", (table) => {
    table.text("id").primary();
    table.text("bim_model_id").notNullable().references("id").inTable("bim_models").onDelete("CASCADE");
    table.text("element_guid").notNullable();
    table.text("link_type").notNullable();
    table.text("target_id").notNullable();
    table.text("target_table").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["bim_model_id", "element_guid"]);
    table.index(["link_type", "target_id"]);
  });
  await knex.raw(
    `ALTER TABLE bim_element_links ADD CONSTRAINT bim_element_links_type_check CHECK (link_type IN (${check(LINK_TYPE)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("bim_element_links");
  await knex.schema.dropTableIfExists("bim_coordination_issues");
  await knex.schema.dropTableIfExists("bim_elements");
  await knex.schema.dropTableIfExists("bim_model_versions");
  await knex.schema.dropTableIfExists("bim_models");
}
