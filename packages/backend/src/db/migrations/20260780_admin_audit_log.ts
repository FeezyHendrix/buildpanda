import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("admin_audit_log", (table) => {
    table.bigIncrements("id").primary();
    table
      .text("admin_user_id")
      .notNullable()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.text("action").notNullable();
    table.text("target_type");
    table.text("target_id");
    table.text("method").notNullable();
    table.text("path").notNullable();
    table.text("route");
    table.text("ip");
    table.integer("status_code");
    table.jsonb("metadata");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(
    `CREATE INDEX admin_audit_admin_created_idx ON admin_audit_log (admin_user_id, created_at DESC)`,
  );
  await knex.raw(
    `CREATE INDEX admin_audit_action_created_idx ON admin_audit_log (action, created_at DESC)`,
  );
  await knex.raw(
    `CREATE INDEX admin_audit_target_idx ON admin_audit_log (target_type, target_id) WHERE target_id IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX admin_audit_created_idx ON admin_audit_log (created_at DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("admin_audit_log");
}
