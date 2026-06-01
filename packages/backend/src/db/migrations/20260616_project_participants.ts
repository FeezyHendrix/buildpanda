import type { Knex } from "knex";

const ROLE = ["client", "architect", "inspector", "guest"] as const;
const STATUS = ["invited", "active", "revoked"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Project participants: external stakeholders attached to a single project
 * (primarily the homeowner / "client"), distinct from company staff who reach a
 * project via organization membership. A client gets a read-mostly portal scoped
 * to their build and can act only on their own things (approvals, queries).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_participants", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("user_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("email").notNullable();
    table.text("role").notNullable().defaultTo("client");
    table.text("status").notNullable().defaultTo("invited");
    table.text("invited_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("invite_token");
    table.timestamp("invite_expires_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "status"]);
    table.index(["project_id", "status"]);
    table.unique(["invite_token"]);
  });
  await knex.raw(
    `ALTER TABLE project_participants ADD CONSTRAINT project_participants_role_check CHECK (role IN (${check(ROLE)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_participants ADD CONSTRAINT project_participants_status_check CHECK (status IN (${check(STATUS)}))`,
  );
  // One active membership per (project, user).
  await knex.raw(
    `CREATE UNIQUE INDEX project_participants_project_user ON project_participants(project_id, user_id) WHERE user_id IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_participants");
}
