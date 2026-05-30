import type { Knex } from "knex";

const UPDATE_STATUSES = ["Open", "Approved", "Inspected", "Resolved", "Escalated"] as const;
const DISPUTE_STATUSES = ["Open", "Resolved", "Withdrawn"] as const;
const NOTIFICATION_TYPES = [
  "update_posted",
  "update_action_required",
  "inspection_scheduled",
  "milestone_released",
  "milestone_disputed",
  "document_uploaded",
] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("uploaded_files", (table) => {
    table.text("id").primary();
    table.text("owner_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("file_name").notNullable();
    table.text("mime_type").notNullable();
    table.bigInteger("size_bytes").notNullable();
    table.text("storage_path").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["owner_id", "created_at"]);
  });

  await knex.schema.alterTable("project_documents", (table) => {
    table.text("file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    table.bigInteger("size_bytes");
  });

  await knex.schema.alterTable("project_updates", (table) => {
    table.text("status").notNullable().defaultTo("Open");
    table.timestamp("action_taken_at", { useTz: true });
    table.text("action_taken_by_id");
    table.text("action_taken_by_name");
  });
  await knex.raw(
    `ALTER TABLE project_updates ADD CONSTRAINT project_updates_status_check CHECK (status IN (${check(UPDATE_STATUSES)}))`,
  );

  await knex.schema.createTable("update_comments", (table) => {
    table.text("id").primary();
    table.text("update_id").notNullable().references("id").inTable("project_updates").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["update_id", "created_at"]);
  });

  await knex.schema.createTable("milestone_disputes", (table) => {
    table.text("id").primary();
    table
      .text("milestone_id")
      .notNullable()
      .references("id")
      .inTable("milestone_payments")
      .onDelete("CASCADE");
    table.text("raised_by_id").notNullable();
    table.text("raised_by_name").notNullable();
    table.text("reason").notNullable();
    table.text("status").notNullable().defaultTo("Open");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("resolved_at", { useTz: true });
    table.index(["milestone_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE milestone_disputes ADD CONSTRAINT milestone_disputes_status_check CHECK (status IN (${check(DISPUTE_STATUSES)}))`,
  );

  await knex.schema.createTable("notifications", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body").notNullable();
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.timestamp("read_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "read_at"]);
    table.index(["user_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (${check(NOTIFICATION_TYPES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("notifications");
  await knex.schema.dropTableIfExists("milestone_disputes");
  await knex.schema.dropTableIfExists("update_comments");

  await knex.schema.alterTable("project_updates", (table) => {
    table.dropColumn("action_taken_by_name");
    table.dropColumn("action_taken_by_id");
    table.dropColumn("action_taken_at");
    table.dropColumn("status");
  });

  await knex.schema.alterTable("project_documents", (table) => {
    table.dropColumn("size_bytes");
    table.dropColumn("file_id");
  });

  await knex.schema.dropTableIfExists("uploaded_files");
}
