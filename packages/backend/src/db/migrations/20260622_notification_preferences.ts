import type { Knex } from "knex";

const ORIGINAL_NOTIFICATION_TYPES = [
  "update_posted",
  "update_action_required",
  "inspection_scheduled",
  "milestone_released",
  "milestone_disputed",
  "document_uploaded",
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("notification_preferences", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("type").notNullable();
    table.boolean("in_app_enabled").notNullable().defaultTo(true);
    table.boolean("email_enabled").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "type"]);
  });

  await knex.raw(
    "ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check",
  );
}

export async function down(knex: Knex): Promise<void> {
  const list = ORIGINAL_NOTIFICATION_TYPES.map((v) => `'${v}'`).join(", ");
  await knex.raw(
    `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (${list}))`,
  );
  await knex.schema.dropTableIfExists("notification_preferences");
}
